use std::collections::HashMap;

use bytemuck::{Pod, Zeroable};
use wgpu::util::DeviceExt;

use crate::media::MediaStore;
use crate::protocol::{CompileRequest, FrameRequest, NodeUniforms};
use crate::share::ShareHub;
use crate::text::raster_text;

const PREVIEW_SIZE: u32 = 64;
const MAX_RES: u32 = 512;

#[repr(C)]
#[derive(Clone, Copy, Pod, Zeroable)]
struct PassUniforms {
    mode: u32,
    width: u32,
    height: u32,
    flags: u32,
    time: f32,
    delta: f32,
    amount: f32,
    gain: f32,
    p0: [f32; 4],
    p1: [f32; 4],
    p2: [f32; 4],
    p3: [f32; 4],
    colour_a: [f32; 4],
    colour_b: [f32; 4],
    colour_c: [f32; 4],
    stop_count: u32,
    _pad: [u32; 3],
    stops: [[f32; 4]; 16],
}

#[repr(C)]
#[derive(Clone, Copy, Pod, Zeroable)]
struct SampleUniforms {
    width: u32,
    height: u32,
    pixel_count: u32,
    _pad: u32,
}

#[repr(C)]
#[derive(Clone, Copy, Pod, Zeroable)]
struct PreviewUniforms {
    src_width: u32,
    src_height: u32,
    dst_size: u32,
    _pad: u32,
}

struct NodeGpu {
    width: u32,
    height: u32,
    ty: String,
    inputs: HashMap<String, String>,
    texture: wgpu::Texture,
    view: wgpu::TextureView,
    feedback: Option<(wgpu::Texture, wgpu::TextureView)>,
}

pub struct GpuEngine {
    device: wgpu::Device,
    queue: wgpu::Queue,
    pass_pipeline: wgpu::ComputePipeline,
    pass_layout: wgpu::BindGroupLayout,
    sample_pipeline: wgpu::ComputePipeline,
    sample_layout: wgpu::BindGroupLayout,
    preview_pipeline: wgpu::ComputePipeline,
    preview_layout: wgpu::BindGroupLayout,
    sampler: wgpu::Sampler,
    black_view: wgpu::TextureView,
    nodes: HashMap<String, NodeGpu>,
    pixel_count: u32,
    positions: Vec<f32>,
    pos_buffer: Option<wgpu::Buffer>,
    led_buffer: Option<wgpu::Buffer>,
    led_staging: Option<wgpu::Buffer>,
    media: MediaStore,
    pub share: ShareHub,
}

impl GpuEngine {
    pub fn new() -> Result<Self, String> {
        let instance = wgpu::Instance::default();
        let adapter = pollster::block_on(instance.request_adapter(&wgpu::RequestAdapterOptions {
            power_preference: wgpu::PowerPreference::HighPerformance,
            compatible_surface: None,
            force_fallback_adapter: false,
        }))
        .ok_or_else(|| "no GPU adapter".to_string())?;

        let (device, queue) = pollster::block_on(adapter.request_device(
            &wgpu::DeviceDescriptor {
                label: Some("pixelforge-gpu"),
                required_features: wgpu::Features::empty(),
                required_limits: wgpu::Limits::default(),
                memory_hints: wgpu::MemoryHints::Performance,
            },
            None,
        ))
        .map_err(|e| e.to_string())?;

        let pass_layout = device.create_bind_group_layout(&wgpu::BindGroupLayoutDescriptor {
            label: Some("pass-bgl"),
            entries: &[
                bgl_uniform(0),
                bgl_tex(1),
                bgl_tex(2),
                bgl_tex(3),
                bgl_sampler(4),
                bgl_storage_tex(5, wgpu::TextureFormat::Rgba32Float),
            ],
        });
        let sample_layout = device.create_bind_group_layout(&wgpu::BindGroupLayoutDescriptor {
            label: Some("sample-bgl"),
            entries: &[
                bgl_tex(0),
                bgl_sampler(1),
                bgl_storage(2, true),
                bgl_storage(3, false),
                bgl_uniform(4),
            ],
        });
        let preview_layout = device.create_bind_group_layout(&wgpu::BindGroupLayoutDescriptor {
            label: Some("preview-bgl"),
            entries: &[
                bgl_tex(0),
                bgl_sampler(1),
                bgl_storage_tex(2, wgpu::TextureFormat::Rgba8Unorm),
                bgl_uniform(3),
            ],
        });

        let pass_pipeline = make_compute(&device, &pass_layout, include_str!("shaders/pass.wgsl"), "pass");
        let sample_pipeline = make_compute(&device, &sample_layout, include_str!("shaders/sample.wgsl"), "sample");
        let preview_pipeline = make_compute(&device, &preview_layout, include_str!("shaders/preview.wgsl"), "preview");

        let sampler = device.create_sampler(&wgpu::SamplerDescriptor {
            mag_filter: wgpu::FilterMode::Nearest,
            min_filter: wgpu::FilterMode::Nearest,
            ..Default::default()
        });

        let black = device.create_texture(&wgpu::TextureDescriptor {
            label: Some("black"),
            size: wgpu::Extent3d {
                width: 1,
                height: 1,
                depth_or_array_layers: 1,
            },
            mip_level_count: 1,
            sample_count: 1,
            dimension: wgpu::TextureDimension::D2,
            format: wgpu::TextureFormat::Rgba32Float,
            usage: wgpu::TextureUsages::TEXTURE_BINDING | wgpu::TextureUsages::COPY_DST,
            view_formats: &[],
        });
        let black_bpr = align256(16);
        let mut black_bytes = vec![0u8; black_bpr as usize];
        black_bytes[..16].copy_from_slice(bytemuck::bytes_of(&[0f32, 0.0, 0.0, 1.0]));
        queue.write_texture(
            wgpu::TexelCopyTextureInfo {
                texture: &black,
                mip_level: 0,
                origin: wgpu::Origin3d::ZERO,
                aspect: wgpu::TextureAspect::All,
            },
            &black_bytes,
            wgpu::TexelCopyBufferLayout {
                offset: 0,
                bytes_per_row: Some(black_bpr),
                rows_per_image: Some(1),
            },
            wgpu::Extent3d {
                width: 1,
                height: 1,
                depth_or_array_layers: 1,
            },
        );

        Ok(Self {
            device,
            queue,
            pass_pipeline,
            pass_layout,
            sample_pipeline,
            sample_layout,
            preview_pipeline,
            preview_layout,
            sampler,
            black_view: black.create_view(&Default::default()),
            nodes: HashMap::new(),
            pixel_count: 0,
            positions: Vec::new(),
            pos_buffer: None,
            led_buffer: None,
            led_staging: None,
            media: MediaStore::new(),
            share: ShareHub::new(),
        })
    }

    pub fn compile(&mut self, req: CompileRequest, positions: Vec<f32>) -> Result<(), String> {
        self.nodes.clear();
        self.pixel_count = req.pixel_count.max(1);
        self.positions = positions;
        if self.positions.len() < (self.pixel_count as usize) * 3 {
            self.positions.resize((self.pixel_count as usize) * 3, 0.5);
        }
        self.pos_buffer = Some(self.device.create_buffer_init(&wgpu::util::BufferInitDescriptor {
            label: Some("positions"),
            contents: bytemuck::cast_slice(&self.positions),
            usage: wgpu::BufferUsages::STORAGE,
        }));
        let led_bytes = (self.pixel_count as u64) * 3 * 4;
        self.led_buffer = Some(self.device.create_buffer(&wgpu::BufferDescriptor {
            label: Some("leds"),
            size: led_bytes,
            usage: wgpu::BufferUsages::STORAGE | wgpu::BufferUsages::COPY_SRC,
            mapped_at_creation: false,
        }));
        self.led_staging = Some(self.device.create_buffer(&wgpu::BufferDescriptor {
            label: Some("leds-staging"),
            size: led_bytes,
            usage: wgpu::BufferUsages::MAP_READ | wgpu::BufferUsages::COPY_DST,
            mapped_at_creation: false,
        }));

        for node in req.nodes {
            let w = node.width.clamp(1, MAX_RES);
            let h = node.height.clamp(1, MAX_RES);
            let texture = make_target(&self.device, w, h, &node.id);
            let view = texture.create_view(&Default::default());
            let feedback = if node.ty == "composite/feedback" {
                let tex = make_target(&self.device, w, h, &format!("{}-fb", node.id));
                let view = tex.create_view(&Default::default());
                Some((tex, view))
            } else {
                None
            };
            self.nodes.insert(
                node.id,
                NodeGpu {
                    width: w,
                    height: h,
                    ty: node.ty,
                    inputs: node.inputs,
                    texture,
                    view,
                    feedback,
                },
            );
        }
        Ok(())
    }

    pub fn frame(
        &mut self,
        req: FrameRequest,
        uploads: &HashMap<String, (u32, u32, Vec<f32>)>,
    ) -> Result<FrameOut, String> {
        for media in &req.media {
            self.media.ensure(&media.node_id, &media.path, &media.kind, req.time_ms);
        }
        let mut native_share = Vec::new();
        for share_in in &req.share_in {
            let key = format!("{}__media", share_in.node_id);
            if let Some((w, h, rgba)) = self.share.receive(&share_in.sender) {
                self.upload_rgba(&key, w, h, &rgba);
                native_share.push(key);
            }
        }
        for upload in &req.cpu_uploads {
            if native_share.iter().any(|k| k == &upload.node_id) {
                continue;
            }
            if let Some((w, h, rgb)) = uploads.get(&upload.node_id) {
                self.upload_rgb(&upload.node_id, *w, *h, rgb);
            }
        }

        let mut encoder = self
            .device
            .create_command_encoder(&wgpu::CommandEncoderDescriptor {
                label: Some("frame"),
            });

        for id in &req.live_node_ids {
            let uniforms = req.uniforms.get(id).cloned().unwrap_or_default();
            self.dispatch_node(&mut encoder, id, &req, &uniforms)?;
        }
        self.queue.submit(Some(encoder.finish()));
        self.device.poll(wgpu::Maintain::Wait);

        let mut samples = HashMap::new();
        for sample_id in &req.sample_node_ids {
            if let Some(rgb) = self.sample_and_read(sample_id)? {
                samples.insert(sample_id.clone(), rgb);
            }
        }

        let mut previews = HashMap::new();
        for preview_id in &req.preview_node_ids {
            if let Some(rgb8) = self.preview_and_read(preview_id)? {
                previews.insert(preview_id.clone(), rgb8);
            }
        }

        for out in &req.share_out {
            if out.from_cpu {
                let key = format!("share:{}", out.node_id);
                if let Some((w, h, rgb)) = uploads.get(&key) {
                    self.share.publish(&out.name, *w, *h, &rgb_to_rgba(rgb));
                }
            } else if let Some(rgba) = self.readback_rgba8(&out.source_node_id, out.width, out.height) {
                self.share.publish(&out.name, out.width, out.height, &rgba);
            }
        }

        Ok(FrameOut {
            samples,
            previews,
            share_senders: self.share.list_senders(),
            share_error: self.share.error.clone(),
        })
    }

    fn dispatch_node(
        &mut self,
        encoder: &mut wgpu::CommandEncoder,
        id: &str,
        req: &FrameRequest,
        uniforms: &NodeUniforms,
    ) -> Result<(), String> {
        let ty = self
            .nodes
            .get(id)
            .ok_or_else(|| format!("unknown gpu node {id}"))?
            .ty
            .clone();

        if ty == "generator/text" {
            let (w, h) = {
                let n = self.nodes.get(id).unwrap();
                (n.width, n.height)
            };
            let rgb = raster_text(w, h, req.time_ms, uniforms);
            self.upload_rgb(id, w, h, &rgb);
            return Ok(());
        }

        if ty == "generator/video" || ty == "generator/image" {
            if let Some((w, h, rgba)) = self.media.frame_rgba(id, req.time_ms) {
                self.upload_rgba(&format!("{id}__media"), w, h, &rgba);
                self.ensure_scratch(&format!("{id}__media"), w, h);
            }
        }

        let (width, height) = {
            let n = self.nodes.get(id).unwrap();
            (n.width, n.height)
        };

        if ty == "transform/blur" {
            let radius = uniforms.floats.get(2).copied().unwrap_or(2.0).round() as i32;
            let dir = uniforms.strings.first().map(|s| s.as_str()).unwrap_or("both");
            if radius <= 0 {
                self.dispatch_pass(encoder, id, req, uniforms, 37, None)?;
                return Ok(());
            }
            let scratch = format!("{id}__blur");
            self.ensure_scratch(&scratch, width, height);
            if dir == "vertical" {
                self.dispatch_pass(encoder, id, req, uniforms, 12, None)?;
            } else if dir == "horizontal" {
                self.dispatch_pass(encoder, id, req, uniforms, 11, None)?;
            } else {
                self.dispatch_pass_to(encoder, id, &scratch, req, uniforms, 11)?;
                self.dispatch_pass_from(encoder, id, &scratch, req, uniforms, 12)?;
            }
            return Ok(());
        }

        if ty == "composite/feedback" {
            if req.feedback_resets.iter().any(|r| r == id) {
                self.clear_feedback(id);
            }
            self.dispatch_pass(encoder, id, req, uniforms, 10, None)?;
            self.copy_to_feedback(encoder, id);
            return Ok(());
        }

        let mode = mode_for_type(&ty, uniforms);
        self.dispatch_pass(encoder, id, req, uniforms, mode, None)
    }

    fn dispatch_pass(
        &self,
        encoder: &mut wgpu::CommandEncoder,
        id: &str,
        req: &FrameRequest,
        uniforms: &NodeUniforms,
        mode: u32,
        override_a: Option<&str>,
    ) -> Result<(), String> {
        self.dispatch_pass_inner(encoder, id, id, req, uniforms, mode, override_a)
    }

    fn dispatch_pass_to(
        &self,
        encoder: &mut wgpu::CommandEncoder,
        id: &str,
        dest: &str,
        req: &FrameRequest,
        uniforms: &NodeUniforms,
        mode: u32,
    ) -> Result<(), String> {
        self.dispatch_pass_inner(encoder, id, dest, req, uniforms, mode, None)
    }

    fn dispatch_pass_from(
        &self,
        encoder: &mut wgpu::CommandEncoder,
        id: &str,
        src: &str,
        req: &FrameRequest,
        uniforms: &NodeUniforms,
        mode: u32,
    ) -> Result<(), String> {
        self.dispatch_pass_inner(encoder, id, id, req, uniforms, mode, Some(src))
    }

    fn dispatch_pass_inner(
        &self,
        encoder: &mut wgpu::CommandEncoder,
        logic_id: &str,
        dest_id: &str,
        req: &FrameRequest,
        uniforms: &NodeUniforms,
        mode: u32,
        override_a: Option<&str>,
    ) -> Result<(), String> {
        let node = self.nodes.get(logic_id).ok_or_else(|| format!("missing {logic_id}"))?;
        let dest = self.nodes.get(dest_id).ok_or_else(|| format!("missing dest {dest_id}"))?;
        let ubo = pack_uniforms(mode, node.width, node.height, req.time_ms / 1000.0, req.delta_ms / 1000.0, uniforms);
        let uniform_buf = self.device.create_buffer_init(&wgpu::util::BufferInitDescriptor {
            label: Some("pass-ubo"),
            contents: bytemuck::bytes_of(&ubo),
            usage: wgpu::BufferUsages::UNIFORM,
        });

        let view_a = self.input_view(node, "pixels", "a", override_a);
        let view_b = if node.ty == "composite/feedback" {
            node.feedback
                .as_ref()
                .map(|(_, v)| v)
                .unwrap_or(&self.black_view)
        } else {
            self.input_view(node, "b", "map", None)
        };
        let view_c = self.input_view(node, "c", "c", None);
        if mode == 29 {
            let media_id = format!("{logic_id}__media");
            let view_a = self
                .nodes
                .get(&media_id)
                .map(|n| &n.view)
                .unwrap_or(view_a);
            return self.run_pass(encoder, &uniform_buf, view_a, view_b, view_c, &dest.view, dest.width, dest.height);
        }

        self.run_pass(
            encoder,
            &uniform_buf,
            view_a,
            view_b,
            view_c,
            &dest.view,
            dest.width,
            dest.height,
        )
    }

    fn run_pass(
        &self,
        encoder: &mut wgpu::CommandEncoder,
        uniform_buf: &wgpu::Buffer,
        view_a: &wgpu::TextureView,
        view_b: &wgpu::TextureView,
        view_c: &wgpu::TextureView,
        dest: &wgpu::TextureView,
        width: u32,
        height: u32,
    ) -> Result<(), String> {
        let bg = self.device.create_bind_group(&wgpu::BindGroupDescriptor {
            label: Some("pass-bg"),
            layout: &self.pass_layout,
            entries: &[
                wgpu::BindGroupEntry {
                    binding: 0,
                    resource: uniform_buf.as_entire_binding(),
                },
                wgpu::BindGroupEntry {
                    binding: 1,
                    resource: wgpu::BindingResource::TextureView(view_a),
                },
                wgpu::BindGroupEntry {
                    binding: 2,
                    resource: wgpu::BindingResource::TextureView(view_b),
                },
                wgpu::BindGroupEntry {
                    binding: 3,
                    resource: wgpu::BindingResource::TextureView(view_c),
                },
                wgpu::BindGroupEntry {
                    binding: 4,
                    resource: wgpu::BindingResource::Sampler(&self.sampler),
                },
                wgpu::BindGroupEntry {
                    binding: 5,
                    resource: wgpu::BindingResource::TextureView(dest),
                },
            ],
        });
        {
            let mut pass = encoder.begin_compute_pass(&wgpu::ComputePassDescriptor {
                label: Some("top-pass"),
                timestamp_writes: None,
            });
            pass.set_pipeline(&self.pass_pipeline);
            pass.set_bind_group(0, &bg, &[]);
            pass.dispatch_workgroups(width.div_ceil(8), height.div_ceil(8), 1);
        }
        Ok(())
    }

    fn input_view<'a>(&'a self, node: &'a NodeGpu, port: &str, alt: &str, override_a: Option<&str>) -> &'a wgpu::TextureView {
        if let Some(id) = override_a {
            if let Some(n) = self.nodes.get(id) {
                return &n.view;
            }
        }
        let src = node
            .inputs
            .get(port)
            .or_else(|| node.inputs.get(alt));
        match src {
            Some(id) => self.nodes.get(id).map(|n| &n.view).unwrap_or(&self.black_view),
            None => &self.black_view,
        }
    }

    fn ensure_scratch(&mut self, id: &str, w: u32, h: u32) {
        if let Some(n) = self.nodes.get(id) {
            if n.width == w && n.height == h {
                return;
            }
            self.nodes.remove(id);
        }
        let texture = make_target(&self.device, w, h, id);
        let view = texture.create_view(&Default::default());
        self.nodes.insert(
            id.to_string(),
            NodeGpu {
                width: w,
                height: h,
                ty: "scratch".into(),
                inputs: HashMap::new(),
                texture,
                view,
                feedback: None,
            },
        );
    }

    fn copy_to_feedback(&self, encoder: &mut wgpu::CommandEncoder, id: &str) {
        let node = match self.nodes.get(id) {
            Some(n) => n,
            None => return,
        };
        let fb = match &node.feedback {
            Some((tex, _)) => tex,
            None => return,
        };
        encoder.copy_texture_to_texture(
            wgpu::TexelCopyTextureInfo {
                texture: &node.texture,
                mip_level: 0,
                origin: wgpu::Origin3d::ZERO,
                aspect: wgpu::TextureAspect::All,
            },
            wgpu::TexelCopyTextureInfo {
                texture: fb,
                mip_level: 0,
                origin: wgpu::Origin3d::ZERO,
                aspect: wgpu::TextureAspect::All,
            },
            wgpu::Extent3d {
                width: node.width,
                height: node.height,
                depth_or_array_layers: 1,
            },
        );
    }

    fn clear_feedback(&self, id: &str) {
        let node = match self.nodes.get(id) {
            Some(n) => n,
            None => return,
        };
        if let Some((tex, _)) = &node.feedback {
            let bpr = align256(node.width * 16);
            let zeros = vec![0u8; (bpr * node.height) as usize];
            self.queue.write_texture(
                wgpu::TexelCopyTextureInfo {
                    texture: tex,
                    mip_level: 0,
                    origin: wgpu::Origin3d::ZERO,
                    aspect: wgpu::TextureAspect::All,
                },
                &zeros,
                wgpu::TexelCopyBufferLayout {
                    offset: 0,
                    bytes_per_row: Some(bpr),
                    rows_per_image: Some(node.height),
                },
                wgpu::Extent3d {
                    width: node.width,
                    height: node.height,
                    depth_or_array_layers: 1,
                },
            );
        }
    }

    fn sample_and_read(&self, id: &str) -> Result<Option<Vec<f32>>, String> {
        let mut encoder = self
            .device
            .create_command_encoder(&wgpu::CommandEncoderDescriptor {
                label: Some("sample"),
            });
        self.sample_node(&mut encoder, id)?;
        self.queue.submit(Some(encoder.finish()));
        self.read_leds_for()
    }

    fn sample_node(&self, encoder: &mut wgpu::CommandEncoder, id: &str) -> Result<(), String> {
        let node = match self.nodes.get(id) {
            Some(n) => n,
            None => return Ok(()),
        };
        let pos = self.pos_buffer.as_ref().ok_or("no positions")?;
        let leds = self.led_buffer.as_ref().ok_or("no leds")?;
        let staging = self.led_staging.as_ref().ok_or("no staging")?;
        let ubo = SampleUniforms {
            width: node.width,
            height: node.height,
            pixel_count: self.pixel_count,
            _pad: 0,
        };
        let uniform_buf = self.device.create_buffer_init(&wgpu::util::BufferInitDescriptor {
            label: Some("sample-ubo"),
            contents: bytemuck::bytes_of(&ubo),
            usage: wgpu::BufferUsages::UNIFORM,
        });
        let bg = self.device.create_bind_group(&wgpu::BindGroupDescriptor {
            label: Some("sample-bg"),
            layout: &self.sample_layout,
            entries: &[
                wgpu::BindGroupEntry {
                    binding: 0,
                    resource: wgpu::BindingResource::TextureView(&node.view),
                },
                wgpu::BindGroupEntry {
                    binding: 1,
                    resource: wgpu::BindingResource::Sampler(&self.sampler),
                },
                wgpu::BindGroupEntry {
                    binding: 2,
                    resource: pos.as_entire_binding(),
                },
                wgpu::BindGroupEntry {
                    binding: 3,
                    resource: leds.as_entire_binding(),
                },
                wgpu::BindGroupEntry {
                    binding: 4,
                    resource: uniform_buf.as_entire_binding(),
                },
            ],
        });
        {
            let mut pass = encoder.begin_compute_pass(&wgpu::ComputePassDescriptor {
                label: Some("sample"),
                timestamp_writes: None,
            });
            pass.set_pipeline(&self.sample_pipeline);
            pass.set_bind_group(0, &bg, &[]);
            pass.dispatch_workgroups(self.pixel_count.div_ceil(64), 1, 1);
        }
        encoder.copy_buffer_to_buffer(leds, 0, staging, 0, (self.pixel_count as u64) * 12);
        Ok(())
    }

    fn preview_and_read(&self, id: &str) -> Result<Option<Vec<u8>>, String> {
        let node = match self.nodes.get(id) {
            Some(n) => n,
            None => return Ok(None),
        };
        let preview = self.device.create_texture(&wgpu::TextureDescriptor {
            label: Some("preview"),
            size: wgpu::Extent3d {
                width: PREVIEW_SIZE,
                height: PREVIEW_SIZE,
                depth_or_array_layers: 1,
            },
            mip_level_count: 1,
            sample_count: 1,
            dimension: wgpu::TextureDimension::D2,
            format: wgpu::TextureFormat::Rgba8Unorm,
            usage: wgpu::TextureUsages::STORAGE_BINDING | wgpu::TextureUsages::COPY_SRC,
            view_formats: &[],
        });
        let view = preview.create_view(&Default::default());
        let ubo = PreviewUniforms {
            src_width: node.width,
            src_height: node.height,
            dst_size: PREVIEW_SIZE,
            _pad: 0,
        };
        let uniform_buf = self.device.create_buffer_init(&wgpu::util::BufferInitDescriptor {
            label: Some("preview-ubo"),
            contents: bytemuck::bytes_of(&ubo),
            usage: wgpu::BufferUsages::UNIFORM,
        });
        let bg = self.device.create_bind_group(&wgpu::BindGroupDescriptor {
            label: Some("preview-bg"),
            layout: &self.preview_layout,
            entries: &[
                wgpu::BindGroupEntry {
                    binding: 0,
                    resource: wgpu::BindingResource::TextureView(&node.view),
                },
                wgpu::BindGroupEntry {
                    binding: 1,
                    resource: wgpu::BindingResource::Sampler(&self.sampler),
                },
                wgpu::BindGroupEntry {
                    binding: 2,
                    resource: wgpu::BindingResource::TextureView(&view),
                },
                wgpu::BindGroupEntry {
                    binding: 3,
                    resource: uniform_buf.as_entire_binding(),
                },
            ],
        });
        let mut encoder = self.device.create_command_encoder(&Default::default());
        {
            let mut pass = encoder.begin_compute_pass(&wgpu::ComputePassDescriptor {
                label: Some("preview"),
                timestamp_writes: None,
            });
            pass.set_pipeline(&self.preview_pipeline);
            pass.set_bind_group(0, &bg, &[]);
            pass.dispatch_workgroups(PREVIEW_SIZE.div_ceil(8), PREVIEW_SIZE.div_ceil(8), 1);
        }
        self.queue.submit(Some(encoder.finish()));
        Ok(self.read_preview_rgb(&preview))
    }

    fn readback_rgba8(&self, id: &str, dst_w: u32, dst_h: u32) -> Option<Vec<u8>> {
        let node = self.nodes.get(id)?;
        let src_w = node.width.max(1);
        let src_h = node.height.max(1);
        let dw = dst_w.clamp(1, 1024);
        let dh = dst_h.clamp(1, 1024);
        let bpr = align256(src_w * 16);
        let staging = self.device.create_buffer(&wgpu::BufferDescriptor {
            label: Some("share-staging"),
            size: (bpr * src_h) as u64,
            usage: wgpu::BufferUsages::MAP_READ | wgpu::BufferUsages::COPY_DST,
            mapped_at_creation: false,
        });
        let mut encoder = self.device.create_command_encoder(&Default::default());
        encoder.copy_texture_to_buffer(
            wgpu::TexelCopyTextureInfo {
                texture: &node.texture,
                mip_level: 0,
                origin: wgpu::Origin3d::ZERO,
                aspect: wgpu::TextureAspect::All,
            },
            wgpu::TexelCopyBufferInfo {
                buffer: &staging,
                layout: wgpu::TexelCopyBufferLayout {
                    offset: 0,
                    bytes_per_row: Some(bpr),
                    rows_per_image: Some(src_h),
                },
            },
            wgpu::Extent3d {
                width: src_w,
                height: src_h,
                depth_or_array_layers: 1,
            },
        );
        self.queue.submit(Some(encoder.finish()));
        let slice = staging.slice(..);
        let (tx, rx) = std::sync::mpsc::channel();
        slice.map_async(wgpu::MapMode::Read, move |r| {
            let _ = tx.send(r);
        });
        self.device.poll(wgpu::Maintain::Wait);
        rx.recv().ok()?.ok()?;
        let data = slice.get_mapped_range();
        let mut out = vec![0u8; (dw * dh * 4) as usize];
        for y in 0..dh {
            let sy = ((y as f32 + 0.5) * src_h as f32 / dh as f32).floor() as u32;
            let sy = sy.min(src_h - 1);
            let row = &data[(sy * bpr) as usize..];
            for x in 0..dw {
                let sx = ((x as f32 + 0.5) * src_w as f32 / dw as f32).floor() as u32;
                let sx = sx.min(src_w - 1);
                let si = (sx * 16) as usize;
                let r = f32_from_le(&row[si..si + 4]).clamp(0.0, 1.0);
                let g = f32_from_le(&row[si + 4..si + 8]).clamp(0.0, 1.0);
                let b = f32_from_le(&row[si + 8..si + 12]).clamp(0.0, 1.0);
                let di = ((y * dw + x) * 4) as usize;
                out[di] = (r * 255.0).round() as u8;
                out[di + 1] = (g * 255.0).round() as u8;
                out[di + 2] = (b * 255.0).round() as u8;
                out[di + 3] = 255;
            }
        }
        drop(data);
        staging.unmap();
        Some(out)
    }

    fn read_leds_for(&self) -> Result<Option<Vec<f32>>, String> {
        let staging = match &self.led_staging {
            Some(b) => b,
            None => return Ok(None),
        };
        let slice = staging.slice(..);
        let (tx, rx) = std::sync::mpsc::channel();
        slice.map_async(wgpu::MapMode::Read, move |r| {
            let _ = tx.send(r);
        });
        self.device.poll(wgpu::Maintain::Wait);
        rx.recv()
            .map_err(|e| e.to_string())?
            .map_err(|e| e.to_string())?;
        let data = slice.get_mapped_range();
        let floats: Vec<f32> = bytemuck::cast_slice(&data).to_vec();
        drop(data);
        staging.unmap();
        Ok(Some(floats))
    }

    fn read_preview_rgb(&self, texture: &wgpu::Texture) -> Option<Vec<u8>> {
        let bytes_per_row = align256(PREVIEW_SIZE * 4);
        let staging = self.device.create_buffer(&wgpu::BufferDescriptor {
            label: Some("preview-staging"),
            size: (bytes_per_row * PREVIEW_SIZE) as u64,
            usage: wgpu::BufferUsages::MAP_READ | wgpu::BufferUsages::COPY_DST,
            mapped_at_creation: false,
        });
        let mut encoder = self.device.create_command_encoder(&Default::default());
        encoder.copy_texture_to_buffer(
            wgpu::TexelCopyTextureInfo {
                texture,
                mip_level: 0,
                origin: wgpu::Origin3d::ZERO,
                aspect: wgpu::TextureAspect::All,
            },
            wgpu::TexelCopyBufferInfo {
                buffer: &staging,
                layout: wgpu::TexelCopyBufferLayout {
                    offset: 0,
                    bytes_per_row: Some(bytes_per_row),
                    rows_per_image: Some(PREVIEW_SIZE),
                },
            },
            wgpu::Extent3d {
                width: PREVIEW_SIZE,
                height: PREVIEW_SIZE,
                depth_or_array_layers: 1,
            },
        );
        self.queue.submit(Some(encoder.finish()));
        let slice = staging.slice(..);
        let (tx, rx) = std::sync::mpsc::channel();
        slice.map_async(wgpu::MapMode::Read, move |r| {
            let _ = tx.send(r);
        });
        self.device.poll(wgpu::Maintain::Wait);
        rx.recv().ok()?.ok()?;
        let data = slice.get_mapped_range();
        let mut rgb = vec![0u8; (PREVIEW_SIZE * PREVIEW_SIZE * 3) as usize];
        for y in 0..PREVIEW_SIZE {
            let row = &data[(y * bytes_per_row) as usize..];
            for x in 0..PREVIEW_SIZE {
                let si = (x * 4) as usize;
                let di = ((y * PREVIEW_SIZE + x) * 3) as usize;
                rgb[di] = row[si];
                rgb[di + 1] = row[si + 1];
                rgb[di + 2] = row[si + 2];
            }
        }
        drop(data);
        staging.unmap();
        Some(rgb)
    }

    fn upload_rgb(&mut self, id: &str, w: u32, h: u32, rgb: &[f32]) {
        self.ensure_scratch(id, w, h);
        let bpr = align256(w * 16);
        let mut rgba32 = vec![0u8; (bpr * h) as usize];
        for y in 0..h as usize {
            for x in 0..w as usize {
                let i = y * w as usize + x;
                let r = rgb.get(i * 3).copied().unwrap_or(0.0);
                let g = rgb.get(i * 3 + 1).copied().unwrap_or(0.0);
                let b = rgb.get(i * 3 + 2).copied().unwrap_or(0.0);
                let pixel = [r, g, b, 1.0f32];
                let o = y * bpr as usize + x * 16;
                rgba32[o..o + 16].copy_from_slice(bytemuck::bytes_of(&pixel));
            }
        }
        if let Some(node) = self.nodes.get(id) {
            self.queue.write_texture(
                wgpu::TexelCopyTextureInfo {
                    texture: &node.texture,
                    mip_level: 0,
                    origin: wgpu::Origin3d::ZERO,
                    aspect: wgpu::TextureAspect::All,
                },
                &rgba32,
                wgpu::TexelCopyBufferLayout {
                    offset: 0,
                    bytes_per_row: Some(bpr),
                    rows_per_image: Some(h),
                },
                wgpu::Extent3d {
                    width: w,
                    height: h,
                    depth_or_array_layers: 1,
                },
            );
        }
    }

    fn upload_rgba(&mut self, id: &str, w: u32, h: u32, rgba: &[u8]) {
        let mut rgb = vec![0f32; (w * h * 3) as usize];
        for i in 0..(w * h) as usize {
            rgb[i * 3] = rgba.get(i * 4).copied().unwrap_or(0) as f32 / 255.0;
            rgb[i * 3 + 1] = rgba.get(i * 4 + 1).copied().unwrap_or(0) as f32 / 255.0;
            rgb[i * 3 + 2] = rgba.get(i * 4 + 2).copied().unwrap_or(0) as f32 / 255.0;
        }
        self.upload_rgb(id, w, h, &rgb);
    }
}

pub struct FrameOut {
    pub samples: HashMap<String, Vec<f32>>,
    pub previews: HashMap<String, Vec<u8>>,
    pub share_senders: Vec<String>,
    pub share_error: Option<String>,
}

fn make_target(device: &wgpu::Device, w: u32, h: u32, label: &str) -> wgpu::Texture {
    device.create_texture(&wgpu::TextureDescriptor {
        label: Some(label),
        size: wgpu::Extent3d {
            width: w,
            height: h,
            depth_or_array_layers: 1,
        },
        mip_level_count: 1,
        sample_count: 1,
        dimension: wgpu::TextureDimension::D2,
        format: wgpu::TextureFormat::Rgba32Float,
        usage: wgpu::TextureUsages::STORAGE_BINDING
            | wgpu::TextureUsages::TEXTURE_BINDING
            | wgpu::TextureUsages::COPY_SRC
            | wgpu::TextureUsages::COPY_DST,
        view_formats: &[],
    })
}

fn make_compute(
    device: &wgpu::Device,
    layout: &wgpu::BindGroupLayout,
    src: &str,
    label: &str,
) -> wgpu::ComputePipeline {
    let shader = device.create_shader_module(wgpu::ShaderModuleDescriptor {
        label: Some(label),
        source: wgpu::ShaderSource::Wgsl(src.into()),
    });
    let pipe_layout = device.create_pipeline_layout(&wgpu::PipelineLayoutDescriptor {
        label: Some(label),
        bind_group_layouts: &[layout],
        push_constant_ranges: &[],
    });
    device.create_compute_pipeline(&wgpu::ComputePipelineDescriptor {
        label: Some(label),
        layout: Some(&pipe_layout),
        module: &shader,
        entry_point: Some("main"),
        compilation_options: Default::default(),
        cache: None,
    })
}

fn bgl_uniform(binding: u32) -> wgpu::BindGroupLayoutEntry {
    wgpu::BindGroupLayoutEntry {
        binding,
        visibility: wgpu::ShaderStages::COMPUTE,
        ty: wgpu::BindingType::Buffer {
            ty: wgpu::BufferBindingType::Uniform,
            has_dynamic_offset: false,
            min_binding_size: None,
        },
        count: None,
    }
}

fn bgl_tex(binding: u32) -> wgpu::BindGroupLayoutEntry {
    wgpu::BindGroupLayoutEntry {
        binding,
        visibility: wgpu::ShaderStages::COMPUTE,
        ty: wgpu::BindingType::Texture {
            sample_type: wgpu::TextureSampleType::Float { filterable: false },
            view_dimension: wgpu::TextureViewDimension::D2,
            multisampled: false,
        },
        count: None,
    }
}

fn bgl_sampler(binding: u32) -> wgpu::BindGroupLayoutEntry {
    wgpu::BindGroupLayoutEntry {
        binding,
        visibility: wgpu::ShaderStages::COMPUTE,
        ty: wgpu::BindingType::Sampler(wgpu::SamplerBindingType::NonFiltering),
        count: None,
    }
}

fn bgl_storage_tex(binding: u32, format: wgpu::TextureFormat) -> wgpu::BindGroupLayoutEntry {
    wgpu::BindGroupLayoutEntry {
        binding,
        visibility: wgpu::ShaderStages::COMPUTE,
        ty: wgpu::BindingType::StorageTexture {
            access: wgpu::StorageTextureAccess::WriteOnly,
            format,
            view_dimension: wgpu::TextureViewDimension::D2,
        },
        count: None,
    }
}

fn bgl_storage(binding: u32, read_only: bool) -> wgpu::BindGroupLayoutEntry {
    wgpu::BindGroupLayoutEntry {
        binding,
        visibility: wgpu::ShaderStages::COMPUTE,
        ty: wgpu::BindingType::Buffer {
            ty: wgpu::BufferBindingType::Storage { read_only },
            has_dynamic_offset: false,
            min_binding_size: None,
        },
        count: None,
    }
}

fn align256(v: u32) -> u32 {
    (v + 255) & !255
}

fn f32_from_le(bytes: &[u8]) -> f32 {
    f32::from_le_bytes([
        bytes.first().copied().unwrap_or(0),
        bytes.get(1).copied().unwrap_or(0),
        bytes.get(2).copied().unwrap_or(0),
        bytes.get(3).copied().unwrap_or(0),
    ])
}

fn rgb_to_rgba(rgb: &[f32]) -> Vec<u8> {
    let n = rgb.len() / 3;
    let mut out = vec![0u8; n * 4];
    for i in 0..n {
        out[i * 4] = (rgb[i * 3].clamp(0.0, 1.0) * 255.0).round() as u8;
        out[i * 4 + 1] = (rgb[i * 3 + 1].clamp(0.0, 1.0) * 255.0).round() as u8;
        out[i * 4 + 2] = (rgb[i * 3 + 2].clamp(0.0, 1.0) * 255.0).round() as u8;
        out[i * 4 + 3] = 255;
    }
    out
}

fn mode_for_type(ty: &str, u: &NodeUniforms) -> u32 {
    match ty {
        "generator/solid-colour" => 0,
        "generator/gradient" => 1,
        "generator/wave" => 2,
        "generator/noise" => 3,
        "composite/mix" => match u.strings.first().map(|s| s.as_str()).unwrap_or("mix") {
            "add" => 5,
            "multiply" => 6,
            "screen" => 7,
            _ => 4,
        },
        "composite/add" => 5,
        "composite/multiply" => 6,
        "composite/screen" => 7,
        "composite/over" => 8,
        "composite/merge" => 9,
        "composite/feedback" => 10,
        "colour/hsv-shift" => 13,
        "colour/levels" => 14,
        "colour/curves" => 15,
        "colour/palette-map" => 16,
        "colour/correct" => 17,
        "colour/from-value" => 18,
        "logic/switch" => 19,
        "setup/master" => 20,
        "transform/rotate" => 21,
        "transform/kaleidoscope" => 22,
        "transform/displace" => 23,
        "transform/transform" => 24,
        "transform/mirror" => 25,
        "transform/offset" => 26,
        "transform/scale" => 27,
        "transform/mask" => 28,
        "generator/video" | "generator/image" | "generator/syphon-in" => 29,
        "generator/fire" => 30,
        "generator/shader" => match u.strings.first().map(|s| s.as_str()).unwrap_or("plasma") {
            "tunnel" => 32,
            "ripples" => 33,
            "spiral" => 34,
            "checker-warp" => 35,
            "aurora" => 36,
            _ => 31,
        },
        _ => 37,
    }
}

fn pack_uniforms(mode: u32, width: u32, height: u32, time: f32, delta: f32, u: &NodeUniforms) -> PassUniforms {
    let f = |i: usize, d: f32| u.floats.get(i).copied().unwrap_or(d);
    let c = |i: usize| {
        [
            u.colours.get(i * 3).copied().unwrap_or(0.0),
            u.colours.get(i * 3 + 1).copied().unwrap_or(0.0),
            u.colours.get(i * 3 + 2).copied().unwrap_or(0.0),
            1.0,
        ]
    };
    let mut flags = 0u32;
    if let Some(axis) = u.strings.iter().find(|s| {
        matches!(
            s.as_str(),
            "x" | "y" | "z" | "xy" | "index" | "circular"
        )
    }) {
        flags |= match axis.as_str() {
            "y" => 1,
            "z" => 2,
            "xy" => 3,
            "index" => 4,
            "circular" => 5,
            _ => 0,
        };
    }
    if u.strings.iter().any(|s| s == "wrap") {
        flags |= 1 << 4;
    } else if u.strings.iter().any(|s| s == "mirror") {
        flags |= 2 << 4;
    }
    let sub = match u.strings.first().map(|s| s.as_str()) {
        Some("value3d") => 1,
        Some("perlin3d") => 2,
        Some("perlin4d-time") => 3,
        Some("perlin4d-space") => 4,
        Some("contain") => 1,
        Some("cover") => 2,
        Some("max") => 1,
        Some("average") => 2,
        Some("mix") if mode == 10 => 1,
        Some("screen") if mode == 10 => 2,
        Some("multiply") if mode == 10 => 3,
        Some("luminance-y") => 1,
        Some("map") => 2,
        Some("flip") => 1,
        Some("vertical") => 1,
        _ => 0,
    };
    flags |= sub << 6;
    if u.ints.first().copied().unwrap_or(0) != 0 {
        flags |= 1 << 9;
    }
    if u.ints.get(1).copied().unwrap_or(0) != 0 {
        flags |= 1 << 10;
    }
    if u.ints.get(2).copied().unwrap_or(0) != 0 {
        flags |= 1 << 11;
    }
    if u.ints.get(3).copied().unwrap_or(0) != 0 {
        flags |= 1 << 12;
    }

    let mut stops = [[0f32; 4]; 16];
    let mut stop_count = 0u32;
    if let Some(list) = &u.stops {
        for (i, s) in list.iter().take(16).enumerate() {
            stops[i] = [s.r, s.g, s.b, s.t];
            stop_count += 1;
        }
    }

    PassUniforms {
        mode,
        width,
        height,
        flags,
        time,
        delta,
        amount: f(0, 1.0),
        gain: f(1, 1.0),
        p0: [f(2, 0.0), f(3, 1.0), f(4, 0.0), f(5, 1.0)],
        p1: [f(6, 0.5), f(7, 0.5), f(8, 0.5), f(9, 0.0)],
        p2: [f(10, 0.0), f(11, 0.0), f(12, 0.0), f(13, 0.0)],
        p3: [0.0; 4],
        colour_a: c(0),
        colour_b: c(1),
        colour_c: c(2),
        stop_count,
        _pad: [0; 3],
        stops,
    }
}
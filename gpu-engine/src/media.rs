use std::collections::HashMap;
use std::path::{Path, PathBuf};
use std::process::{Command, Stdio};
use std::io::Read;

pub struct MediaStore {
    images: HashMap<String, (u32, u32, Vec<u8>)>,
    videos: HashMap<String, VideoSession>,
}

struct VideoSession {
    path: PathBuf,
    width: u32,
    height: u32,
    frames: Vec<Vec<u8>>,
    fps: f32,
}

impl MediaStore {
    pub fn new() -> Self {
        Self {
            images: HashMap::new(),
            videos: HashMap::new(),
        }
    }

    pub fn ensure(&mut self, node_id: &str, path: &str, kind: &str, _time_ms: f32) {
        if path.is_empty() {
            return;
        }
        let p = Path::new(path);
        if kind == "image" {
            if self.images.contains_key(node_id) {
                return;
            }
            if let Some(decoded) = decode_image(p) {
                self.images.insert(node_id.to_string(), decoded);
            }
        } else if kind == "video" {
            let needs = match self.videos.get(node_id) {
                Some(v) => v.path != p,
                None => true,
            };
            if needs {
                if let Some(session) = decode_video(p) {
                    self.videos.insert(node_id.to_string(), session);
                }
            }
        }
    }

    pub fn frame_rgba(&self, node_id: &str, time_ms: f32) -> Option<(u32, u32, Vec<u8>)> {
        if let Some((w, h, rgba)) = self.images.get(node_id) {
            return Some((*w, *h, rgba.clone()));
        }
        if let Some(v) = self.videos.get(node_id) {
            if v.frames.is_empty() {
                return None;
            }
            let idx = ((time_ms / 1000.0) * v.fps).floor() as usize % v.frames.len();
            return Some((v.width, v.height, v.frames[idx].clone()));
        }
        None
    }
}

fn decode_image(path: &Path) -> Option<(u32, u32, Vec<u8>)> {
    let img = image::open(path).ok()?.to_rgba8();
    let (w, h) = img.dimensions();
    let max_edge = 512u32;
    if w.max(h) <= max_edge {
        return Some((w, h, img.into_raw()));
    }
    let scale = max_edge as f32 / w.max(h) as f32;
    let nw = (w as f32 * scale).round().max(1.0) as u32;
    let nh = (h as f32 * scale).round().max(1.0) as u32;
    let resized = image::imageops::resize(&img, nw, nh, image::imageops::FilterType::Triangle);
    Some((nw, nh, resized.into_raw()))
}

fn decode_video(path: &Path) -> Option<VideoSession> {
    let probe = Command::new("ffprobe")
        .args([
            "-v",
            "error",
            "-select_streams",
            "v:0",
            "-show_entries",
            "stream=width,height,r_frame_rate",
            "-of",
            "csv=p=0",
            path.to_str()?,
        ])
        .output()
        .ok()?;
    if !probe.status.success() {
        return ffmpeg_raw_pipe(path);
    }
    let text = String::from_utf8_lossy(&probe.stdout);
    let mut parts = text.trim().split(',');
    let width: u32 = parts.next()?.parse().ok()?;
    let height: u32 = parts.next()?.parse().ok()?;
    let fps = parse_rate(parts.next().unwrap_or("30/1"));
    ffmpeg_frames(path, width, height, fps)
}

fn parse_rate(s: &str) -> f32 {
    if let Some((a, b)) = s.split_once('/') {
        let n: f32 = a.parse().unwrap_or(30.0);
        let d: f32 = b.parse().unwrap_or(1.0f32).max(0.001);
        return n / d;
    }
    s.parse().unwrap_or(30.0)
}

fn ffmpeg_frames(path: &Path, width: u32, height: u32, fps: f32) -> Option<VideoSession> {
    let max_edge = 512u32;
    let scale = (max_edge as f32 / width.max(height).max(1) as f32).min(1.0);
    let width = (width as f32 * scale).round().max(1.0) as u32;
    let height = (height as f32 * scale).round().max(1.0) as u32;
    let mut child = Command::new("ffmpeg")
        .args([
            "-i",
            path.to_str()?,
            "-vf",
            &format!("scale={width}:{height}"),
            "-f",
            "rawvideo",
            "-pix_fmt",
            "rgba",
            "-an",
            "pipe:1",
        ])
        .stdout(Stdio::piped())
        .stderr(Stdio::null())
        .spawn()
        .ok()?;
    let mut stdout = child.stdout.take()?;
    let frame_size = (width * height * 4) as usize;
    let mut frames = Vec::new();
    let max_bytes = 64 * 1024 * 1024;
    let mut total = 0usize;
    loop {
        let mut buf = vec![0u8; frame_size];
        if stdout.read_exact(&mut buf).is_err() {
            break;
        }
        total += buf.len();
        frames.push(buf);
        if total >= max_bytes {
            break;
        }
    }
    let _ = child.kill();
    if frames.is_empty() {
        return None;
    }
    Some(VideoSession {
        path: path.to_path_buf(),
        width,
        height,
        frames,
        fps,
    })
}

fn ffmpeg_raw_pipe(path: &Path) -> Option<VideoSession> {
    ffmpeg_frames(path, 64, 64, 30.0)
}

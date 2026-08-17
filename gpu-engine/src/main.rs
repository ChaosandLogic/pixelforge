mod gpu;
mod ipc;
mod media;
mod protocol;
mod share;
#[cfg(target_os = "macos")]
mod syphon;
mod text;

use std::collections::HashMap;
use std::io::{self, BufReader, BufWriter};

use serde_json::{json, Value};

use gpu::GpuEngine;
use ipc::{read_message, write_message};
use protocol::{BakeRequest, CompileRequest, FrameRequest, Request};

fn main() {
    let stdin = io::stdin();
    let stdout = io::stdout();
    let mut reader = BufReader::new(stdin.lock());
    let mut writer = BufWriter::new(stdout.lock());

    let engine = match GpuEngine::new() {
        Ok(e) => e,
        Err(err) => {
            eprintln!("[gpu-engine] init failed: {err}");
            let _ = write_message(
                &mut writer,
                &json!({ "id": 0, "kind": "hello-ok", "body": {
                    "kind": "hello-ok", "gpu": false, "share": "none", "error": err
                }}),
                &[],
            );
            loop {
                let Ok(msg) = read_message(&mut reader) else { break };
                let req: Request = match serde_json::from_value(msg.header) {
                    Ok(r) => r,
                    Err(_) => break,
                };
                if req.kind == "shutdown" {
                    break;
                }
                let _ = write_message(
                    &mut writer,
                    &json!({ "id": req.id, "kind": "error", "error": err }),
                    &[],
                );
            }
            return;
        }
    };

    let mut engine = engine;
    loop {
        let msg = match read_message(&mut reader) {
            Ok(m) => m,
            Err(e) if e.kind() == io::ErrorKind::UnexpectedEof => break,
            Err(e) => {
                eprintln!("[gpu-engine] ipc read: {e}");
                break;
            }
        };
        let req: Request = match serde_json::from_value(msg.header.clone()) {
            Ok(r) => r,
            Err(e) => {
                let _ = write_message(
                    &mut writer,
                    &json!({ "id": 0, "kind": "error", "error": e.to_string() }),
                    &[],
                );
                continue;
            }
        };
        if req.kind == "shutdown" {
            break;
        }
        if let Err(e) = handle(&mut engine, &req, &msg.blobs, &mut writer) {
            let _ = write_message(
                &mut writer,
                &json!({ "id": req.id, "kind": "error", "error": e }),
                &[],
            );
        }
    }
}

fn handle(
    engine: &mut GpuEngine,
    req: &Request,
    blobs: &[(String, Vec<u8>)],
    writer: &mut impl io::Write,
) -> Result<(), String> {
    match req.kind.as_str() {
        "hello" => {
            write_message(
                writer,
                &json!({
                    "id": req.id,
                    "kind": "hello-ok",
                    "body": {
                        "kind": "hello-ok",
                        "gpu": true,
                        "share": engine.share.platform_name(),
                        "error": engine.share.error
                    }
                }),
                &[],
            )
            .map_err(|e| e.to_string())?;
        }
        "compile" => {
            let body: CompileRequest = serde_json::from_value(req.body.clone()).map_err(|e| e.to_string())?;
            let positions = blob_f32(blobs, "positions");
            engine.compile(body, positions)?;
            write_message(writer, &json!({ "id": req.id, "kind": "compile-ok" }), &[])
                .map_err(|e| e.to_string())?;
        }
        "frame" => {
            let body: FrameRequest = serde_json::from_value(req.body.clone()).map_err(|e| e.to_string())?;
            let mut uploads = HashMap::new();
            for (name, data) in blobs {
                if let Some(id) = name.strip_prefix("upload:") {
                    let rgb = f32_from_bytes(data);
                    let n = (rgb.len() / 3).max(1);
                    uploads.insert(id.to_string(), (n as u32, 1, rgb));
                }
            }
            let out = engine.frame(body, &uploads)?;
            let mut out_blobs = Vec::new();
            let mut sample_ids = Vec::new();
            for (id, rgb) in &out.samples {
                sample_ids.push(id.clone());
                out_blobs.push((format!("sample:{id}"), f32_to_bytes(rgb)));
            }
            let mut previews = Vec::new();
            for (id, rgb) in &out.previews {
                previews.push(json!({ "nodeId": id, "width": 64, "height": 64 }));
                out_blobs.push((format!("preview:{id}"), rgb.clone()));
            }
            write_message(
                writer,
                &json!({
                    "id": req.id,
                    "kind": "frame-ok",
                    "body": {
                        "error": Value::Null,
                        "shareSenders": out.share_senders,
                        "shareError": out.share_error,
                        "sampleIds": sample_ids,
                        "previews": previews
                    }
                }),
                &out_blobs,
            )
            .map_err(|e| e.to_string())?;
        }
        "bake" => {
            let _body: BakeRequest = serde_json::from_value(req.body.clone()).map_err(|e| e.to_string())?;
            write_message(
                writer,
                &json!({
                    "id": req.id,
                    "kind": "bake-ok",
                    "body": { "error": "bake is driven by host frame ticks", "frameCount": 0, "pixelCount": 0, "fps": 0 }
                }),
                &[],
            )
            .map_err(|e| e.to_string())?;
        }
        other => {
            write_message(
                writer,
                &json!({ "id": req.id, "kind": "error", "error": format!("unknown kind {other}") }),
                &[],
            )
            .map_err(|e| e.to_string())?;
        }
    }
    Ok(())
}

fn blob_f32(blobs: &[(String, Vec<u8>)], name: &str) -> Vec<f32> {
    blobs
        .iter()
        .find(|(n, _)| n == name)
        .map(|(_, d)| f32_from_bytes(d))
        .unwrap_or_default()
}

fn f32_from_bytes(data: &[u8]) -> Vec<f32> {
    data.chunks_exact(4)
        .map(|c| f32::from_le_bytes([c[0], c[1], c[2], c[3]]))
        .collect()
}

fn f32_to_bytes(data: &[f32]) -> Vec<u8> {
    let mut out = Vec::with_capacity(data.len() * 4);
    for v in data {
        out.extend_from_slice(&v.to_le_bytes());
    }
    out
}

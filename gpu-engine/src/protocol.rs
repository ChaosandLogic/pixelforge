use serde::{Deserialize, Serialize};
use serde_json::Value;

#[derive(Debug, Deserialize)]
pub struct Request {
    pub id: u32,
    pub kind: String,
    #[serde(default)]
    pub body: Value,
}

#[derive(Debug, Serialize)]
#[allow(dead_code)]
pub struct Response {
    pub id: u32,
    pub kind: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub error: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub body: Option<Value>,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CompileNode {
    pub id: String,
    #[serde(rename = "type")]
    pub ty: String,
    pub width: u32,
    pub height: u32,
    pub inputs: std::collections::HashMap<String, String>,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CompileRequest {
    pub nodes: Vec<CompileNode>,
    pub pixel_count: u32,
    pub resolution_width: u32,
    pub resolution_height: u32,
}

#[derive(Debug, Deserialize, Clone)]
pub struct GradientStop {
    pub t: f32,
    pub r: f32,
    pub g: f32,
    pub b: f32,
}

#[derive(Debug, Deserialize, Clone, Default)]
pub struct NodeUniforms {
    #[serde(default)]
    pub floats: Vec<f32>,
    #[serde(default)]
    pub colours: Vec<f32>,
    #[serde(default)]
    pub ints: Vec<i32>,
    #[serde(default)]
    pub strings: Vec<String>,
    #[serde(default)]
    pub stops: Option<Vec<GradientStop>>,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct MediaRef {
    pub node_id: String,
    pub path: String,
    pub kind: String,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ShareIn {
    pub node_id: String,
    pub sender: String,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ShareOut {
    pub node_id: String,
    pub name: String,
    pub width: u32,
    pub height: u32,
    pub mapping: String,
    pub source_node_id: String,
    pub from_cpu: bool,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CpuUpload {
    pub node_id: String,
    pub width: u32,
    pub height: u32,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct FrameRequest {
    pub time_ms: f32,
    pub delta_ms: f32,
    pub live_node_ids: Vec<String>,
    pub uniforms: std::collections::HashMap<String, NodeUniforms>,
    #[serde(default)]
    pub cpu_uploads: Vec<CpuUpload>,
    pub sample_node_ids: Vec<String>,
    #[serde(default)]
    pub preview_node_ids: Vec<String>,
    #[serde(default)]
    pub feedback_resets: Vec<String>,
    #[serde(default)]
    pub media: Vec<MediaRef>,
    #[serde(default)]
    pub share_in: Vec<ShareIn>,
    #[serde(default)]
    pub share_out: Vec<ShareOut>,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct BakeRequest {
    pub duration_ms: f32,
    pub fps: f32,
    pub sample_node_id: String,
}

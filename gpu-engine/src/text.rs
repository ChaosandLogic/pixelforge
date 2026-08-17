use crate::protocol::NodeUniforms;

const GW: usize = 5;
const GH: usize = 7;

fn glyph(ch: u8) -> [u8; 35] {
    match ch {
        b'0' => [0,1,1,1,0, 1,0,0,0,1, 1,0,0,0,1, 1,0,0,0,1, 1,0,0,0,1, 0,1,1,1,0, 0,0,0,0,0],
        b'1' => [0,0,1,0,0, 0,1,1,0,0, 0,0,1,0,0, 0,0,1,0,0, 0,0,1,0,0, 0,1,1,1,0, 0,0,0,0,0],
        b'2' => [0,1,1,1,0, 1,0,0,0,1, 0,0,0,0,1, 0,0,1,1,0, 0,1,0,0,0, 1,1,1,1,1, 0,0,0,0,0],
        b'3' => [0,1,1,1,0, 1,0,0,0,1, 0,0,1,1,0, 0,0,0,0,1, 1,0,0,0,1, 0,1,1,1,0, 0,0,0,0,0],
        b'4' => [0,0,0,1,0, 0,0,1,1,0, 0,1,0,1,0, 1,0,0,0,1, 1,1,1,1,1, 0,0,0,1,0, 0,0,0,0,0],
        b'5' => [1,1,1,1,1, 1,0,0,0,0, 1,1,1,0,0, 0,0,0,0,1, 1,0,0,0,1, 0,1,1,1,0, 0,0,0,0,0],
        b'6' => [0,0,1,1,0, 0,1,0,0,0, 1,0,0,0,0, 1,1,1,0,0, 1,0,0,0,1, 0,1,1,1,0, 0,0,0,0,0],
        b'7' => [1,1,1,1,1, 0,0,0,0,1, 0,0,0,1,0, 0,0,1,0,0, 0,1,0,0,0, 1,0,0,0,0, 0,0,0,0,0],
        b'8' => [0,1,1,1,0, 1,0,0,0,1, 0,1,1,1,0, 1,0,0,0,1, 1,0,0,0,1, 0,1,1,1,0, 0,0,0,0,0],
        b'9' => [0,1,1,1,0, 1,0,0,0,1, 0,1,1,1,0, 0,0,0,0,1, 0,0,0,1,0, 0,1,1,0,0, 0,0,0,0,0],
        b':' => [0,0,0,0,0, 0,0,1,0,0, 0,0,0,0,0, 0,0,0,0,0, 0,0,1,0,0, 0,0,0,0,0, 0,0,0,0,0],
        _ => [0; 35],
    }
}

pub fn raster_text(width: u32, height: u32, time_ms: f32, u: &NodeUniforms) -> Vec<f32> {
    let w = width.max(1) as usize;
    let h = height.max(1) as usize;
    let text = u.strings.first().cloned().unwrap_or_else(|| "12:34".into());
    let align = u.strings.get(1).map(|s| s.as_str()).unwrap_or("center");
    let scale = u.floats.first().copied().unwrap_or(1.0).abs().max(0.25);
    let scroll = u.floats.get(1).copied().unwrap_or(0.0) + (time_ms / 1000.0) * u.floats.get(2).copied().unwrap_or(0.0);
    let r = u.colours.first().copied().unwrap_or(1.0);
    let g = u.colours.get(1).copied().unwrap_or(1.0);
    let b = u.colours.get(2).copied().unwrap_or(1.0);
    let bg = u.floats.get(3).copied().unwrap_or(0.0);
    let mut out = vec![bg; w * h * 3];
    let chars: Vec<u8> = text.bytes().map(|c| if c.is_ascii_lowercase() { c - 32 } else { c }).collect();
    let gw = ((GW as f32) * scale).round() as i32;
    let gh = ((GH as f32) * scale).round() as i32;
    let gap = 1;
    let total = chars.len() as i32 * (gw + gap);
    let mut x0 = match align {
        "left" => 0,
        "right" => w as i32 - total,
        _ => (w as i32 - total) / 2,
    };
    x0 -= scroll.round() as i32;
    let y0 = (h as i32 - gh) / 2;
    for (ci, ch) in chars.iter().enumerate() {
        let bits = glyph(*ch);
        let ox = x0 + ci as i32 * (gw + gap);
        for gy in 0..GH {
            for gx in 0..GW {
                if bits[gy * GW + gx] == 0 {
                    continue;
                }
                for sy in 0..scale.max(1.0) as i32 {
                    for sx in 0..scale.max(1.0) as i32 {
                        let x = ox + gx as i32 * gw / GW as i32 + sx;
                        let y = y0 + gy as i32 * gh / GH as i32 + sy;
                        if x < 0 || y < 0 || x >= w as i32 || y >= h as i32 {
                            continue;
                        }
                        let i = ((y as usize) * w + x as usize) * 3;
                        out[i] = r;
                        out[i + 1] = g;
                        out[i + 2] = b;
                    }
                }
            }
        }
    }
    out
}

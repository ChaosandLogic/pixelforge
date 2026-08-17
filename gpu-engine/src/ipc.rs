use std::io::{self, Read, Write};

use serde_json::Value;

pub const MAGIC: u32 = 0x50464750;
pub const VERSION: u32 = 1;

pub struct Message {
    pub header: Value,
    pub blobs: Vec<(String, Vec<u8>)>,
}

fn read_u32<R: Read>(r: &mut R) -> io::Result<u32> {
    let mut buf = [0u8; 4];
    r.read_exact(&mut buf)?;
    Ok(u32::from_le_bytes(buf))
}

fn write_u32<W: Write>(w: &mut W, v: u32) -> io::Result<()> {
    w.write_all(&v.to_le_bytes())
}

pub fn write_message<W: Write>(w: &mut W, header: &Value, blobs: &[(String, Vec<u8>)]) -> io::Result<()> {
    let json = serde_json::to_vec(header).map_err(|e| io::Error::new(io::ErrorKind::InvalidData, e))?;
    write_u32(w, MAGIC)?;
    write_u32(w, VERSION)?;
    write_u32(w, json.len() as u32)?;
    w.write_all(&json)?;
    write_u32(w, blobs.len() as u32)?;
    for (name, data) in blobs {
        write_u32(w, name.len() as u32)?;
        w.write_all(name.as_bytes())?;
        write_u32(w, data.len() as u32)?;
        w.write_all(data)?;
    }
    w.flush()
}

pub fn read_message<R: Read>(r: &mut R) -> io::Result<Message> {
    let magic = read_u32(r)?;
    if magic != MAGIC {
        return Err(io::Error::new(io::ErrorKind::InvalidData, "bad gpu ipc magic"));
    }
    let version = read_u32(r)?;
    if version != VERSION {
        return Err(io::Error::new(
            io::ErrorKind::InvalidData,
            format!("unsupported gpu ipc version {version}"),
        ));
    }
    let header_len = read_u32(r)? as usize;
    let mut header_bytes = vec![0u8; header_len];
    r.read_exact(&mut header_bytes)?;
    let header: Value =
        serde_json::from_slice(&header_bytes).map_err(|e| io::Error::new(io::ErrorKind::InvalidData, e))?;
    let n_blobs = read_u32(r)? as usize;
    let mut blobs = Vec::with_capacity(n_blobs);
    for _ in 0..n_blobs {
        let name_len = read_u32(r)? as usize;
        let mut name = vec![0u8; name_len];
        r.read_exact(&mut name)?;
        let data_len = read_u32(r)? as usize;
        let mut data = vec![0u8; data_len];
        r.read_exact(&mut data)?;
        blobs.push((
            String::from_utf8(name).map_err(|e| io::Error::new(io::ErrorKind::InvalidData, e))?,
            data,
        ));
    }
    Ok(Message { header, blobs })
}

export function alignTo(value: number, alignment: number): number {
  return Math.ceil(value / alignment) * alignment;
}

const bytesPerTexel: Partial<Record<GPUTextureFormat, number>> = {
  r8unorm: 1,
  r16float: 2,
  r32float: 4,
  r32uint: 4,
  rg16float: 4,
  rg32float: 8,
  rgba8unorm: 4,
  'rgba8unorm-srgb': 4,
  bgra8unorm: 4,
  'bgra8unorm-srgb': 4,
  rgba16float: 8,
  rgba32float: 16,
  depth16unorm: 2,
  depth24plus: 4,
  'depth24plus-stencil8': 4,
  depth32float: 4,
};

export interface TextureSizeDescriptor {
  format: GPUTextureFormat;
  width: number;
  height: number;
  depthOrArrayLayers?: number;
  mipLevelCount?: number;
  sampleCount?: number;
}

export function textureByteSize(desc: TextureSizeDescriptor): number {
  const texel = bytesPerTexel[desc.format];
  if (texel === undefined) throw new Error(`No byte size known for texture format ${desc.format}`);
  const layers = desc.depthOrArrayLayers ?? 1;
  let total = 0;
  for (let mip = 0; mip < (desc.mipLevelCount ?? 1); mip++) {
    total += Math.max(1, desc.width >> mip) * Math.max(1, desc.height >> mip) * layers;
  }
  return total * texel * (desc.sampleCount ?? 1);
}

export function extent3d(size: GPUExtent3D): { width: number; height: number; depth: number } {
  if (Symbol.iterator in size) {
    const [width = 1, height = 1, depth = 1] = Array.from(size);
    return { width, height, depth };
  }
  return { width: size.width, height: size.height ?? 1, depth: size.depthOrArrayLayers ?? 1 };
}

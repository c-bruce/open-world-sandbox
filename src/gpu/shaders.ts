export async function createShaderModule(
  device: GPUDevice,
  label: string,
  code: string,
): Promise<GPUShaderModule> {
  const module = device.createShaderModule({ label, code });
  const info = await module.getCompilationInfo();
  const errors = info.messages.filter((m) => m.type === 'error');
  if (errors.length > 0) {
    const lines = errors.map((m) => `  ${String(m.lineNum)}:${String(m.linePos)} ${m.message}`);
    throw new Error(`WGSL compilation failed for "${label}":\n${lines.join('\n')}`);
  }
  return module;
}

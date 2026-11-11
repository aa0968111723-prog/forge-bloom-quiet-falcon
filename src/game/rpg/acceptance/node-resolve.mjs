const EXTENSIONS = [".ts", ".tsx", ".mjs", ".js", ".json"];

function hasKnownExtension(specifier) {
  return EXTENSIONS.some((extension) => specifier.endsWith(extension));
}

export async function resolve(specifier, context, nextResolve) {
  if (!specifier.startsWith(".") || hasKnownExtension(specifier)) {
    return nextResolve(specifier, context);
  }
  let firstError = null;
  for (const extension of [".ts", ".tsx"]) {
    try {
      return await nextResolve(`${specifier}${extension}`, context);
    } catch (error) {
      firstError ??= error;
    }
  }
  try {
    return await nextResolve(`${specifier}/index.ts`, context);
  } catch (error) {
    throw firstError ?? error;
  }
}

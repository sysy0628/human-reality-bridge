export function inspectRuntimeOrigin(locationLike = globalThis.location) {
  const rawOrigin = typeof locationLike?.origin === 'string' ? locationLike.origin.trim() : '';

  if (!rawOrigin) {
    return {
      status: 'unavailable',
      origin: null,
      allowlistCandidate: null,
      message: '当前运行环境没有提供页面 Origin。'
    };
  }

  if (rawOrigin === 'null') {
    return {
      status: 'opaque',
      origin: 'null',
      allowlistCandidate: null,
      message: '当前页面使用不透明 Origin，不能直接加入 HTTPS 白名单。'
    };
  }

  let parsed;
  try {
    parsed = new URL(rawOrigin);
  } catch {
    return {
      status: 'invalid',
      origin: rawOrigin,
      allowlistCandidate: null,
      message: '当前页面报告了无法识别的 Origin。'
    };
  }

  if (parsed.origin !== rawOrigin) {
    return {
      status: 'invalid',
      origin: rawOrigin,
      allowlistCandidate: null,
      message: '当前页面 Origin 不是规范的纯 origin。'
    };
  }

  if (parsed.protocol !== 'https:') {
    return {
      status: 'insecure',
      origin: rawOrigin,
      allowlistCandidate: null,
      message: '当前页面不是 HTTPS Origin，不能用于正式公网控制接口。'
    };
  }

  return {
    status: 'https-candidate',
    origin: rawOrigin,
    allowlistCandidate: rawOrigin,
    message: '这是页面本地观察到的 HTTPS Origin 候选值。'
  };
}

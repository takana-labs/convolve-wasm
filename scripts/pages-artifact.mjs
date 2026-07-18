function requireTag(html, expression, message) {
  if (!expression.test(html)) throw new Error(message);
}

export function validatePagesHtml(
  html,
  { publicUrl, publicLogoUrl, buildSha },
) {
  requireTag(
    html,
    new RegExp(
      `<link\\s+rel=["']canonical["']\\s+href=["']${escapeRegex(publicUrl)}["']`,
      "iu",
    ),
    `Pages HTML canonical URL does not match ${publicUrl}`,
  );
  requireTag(
    html,
    new RegExp(
      `<meta\\s+property=["']og:url["']\\s+content=["']${escapeRegex(publicUrl)}["']`,
      "iu",
    ),
    `Pages HTML Open Graph URL does not match ${publicUrl}`,
  );
  requireTag(
    html,
    new RegExp(
      `<meta\\s+property=["']og:image["']\\s+content=["']${escapeRegex(publicLogoUrl)}["']`,
      "iu",
    ),
    `Pages HTML Open Graph image does not match ${publicLogoUrl}`,
  );
  requireTag(
    html,
    new RegExp(
      `<meta\\s+name=["']convolve-build["']\\s+content=["']${escapeRegex(buildSha)}["']`,
      "iu",
    ),
    `Pages HTML build SHA does not match ${buildSha}`,
  );

  for (const match of html.matchAll(/(?:src|href)=["']([^"']+)["']/giu)) {
    const reference = match[1];
    if (
      !reference ||
      reference.startsWith("#") ||
      reference.startsWith("data:") ||
      reference.startsWith("blob:") ||
      /^[a-z][a-z\d+.-]*:/iu.test(reference)
    ) {
      continue;
    }
    if (reference.startsWith("/")) {
      throw new Error(
        `Pages HTML must use a relative local asset reference, not ${reference}`,
      );
    }
  }
}

function escapeRegex(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/gu, "\\$&");
}

const ENGINE_REVISION_PATTERN = /^[0-9a-f]{40}$/;

export function getEnclosureEngineRevision() {
  const revision = process.env.ENCLOSURE_ENGINE_REVISION?.trim().toLowerCase();
  if (!revision || !ENGINE_REVISION_PATTERN.test(revision)) {
    throw new Error('The enclosure engine revision is not configured.');
  }
  return revision;
}

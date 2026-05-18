const BASE_URL = 'https://www.sanity.io/docs/help/'

export function generateHelpUrl(slug: string): string {
  return BASE_URL + slug
}

import { Helmet } from 'react-helmet-async';
import { DEFAULT_DESCRIPTION, DEFAULT_IMAGE, DEFAULT_TITLE, SITE_NAME, absoluteUrl, cleanMetaText, safeJsonLd } from '@/lib/seo';

type SEOProps = {
  title?: string;
  description?: string;
  path?: string;
  image?: string;
  type?: 'website' | 'product' | 'article';
  schema?: unknown | unknown[];
};

const SEO = ({
  title = DEFAULT_TITLE,
  description = DEFAULT_DESCRIPTION,
  path = '/',
  image = DEFAULT_IMAGE,
  type = 'website',
  schema,
}: SEOProps) => {
  const metaTitle = cleanMetaText(title, 70);
  const metaDescription = cleanMetaText(description, 160);
  const canonical = absoluteUrl(path);
  const imageUrl = absoluteUrl(image);
  const schemas = Array.isArray(schema) ? schema : schema ? [schema] : [];

  return (
    <Helmet>
      <title>{metaTitle}</title>
      <meta name="description" content={metaDescription} />
      <link rel="canonical" href={canonical} />
      <meta property="og:type" content={type} />
      <meta property="og:site_name" content={SITE_NAME} />
      <meta property="og:url" content={canonical} />
      <meta property="og:title" content={metaTitle} />
      <meta property="og:description" content={metaDescription} />
      <meta property="og:image" content={imageUrl} />
      <meta name="twitter:card" content="summary_large_image" />
      <meta name="twitter:title" content={metaTitle} />
      <meta name="twitter:description" content={metaDescription} />
      <meta name="twitter:image" content={imageUrl} />
      {schemas.map((item, index) => (
        <script key={index} type="application/ld+json">
          {safeJsonLd(item)}
        </script>
      ))}
    </Helmet>
  );
};

export default SEO;

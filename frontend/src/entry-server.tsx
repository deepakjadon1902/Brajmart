import { PassThrough } from 'node:stream';
import { renderToPipeableStream } from 'react-dom/server';
import { StaticRouter } from 'react-router-dom/server';
import { HelmetProvider } from 'react-helmet-async';
import { ThemeProvider } from 'next-themes';
import ServerApp from './ServerApp';
import { applyInitialData, setInitialData, type BrajmartInitialData } from './lib/initialData';

type HelmetContext = any;

const streamToString = (url: string, helmetContext: HelmetContext) =>
  new Promise<string>((resolve, reject) => {
    let html = '';
    const output = new PassThrough();
    output.setEncoding('utf8');
    output.on('data', (chunk) => { html += chunk; });
    output.on('end', () => resolve(html));
    output.on('error', reject);

    const { pipe, abort } = renderToPipeableStream(
      <HelmetProvider context={helmetContext}>
        <ThemeProvider attribute="class" defaultTheme="light" enableSystem>
          <StaticRouter location={url}>
            <ServerApp />
          </StaticRouter>
        </ThemeProvider>
      </HelmetProvider>,
      {
        onAllReady() { pipe(output); },
        onShellError: reject,
        onError(error) { console.error(`SSR render error for ${url}:`, error); },
      },
    );
    setTimeout(() => abort(), 30_000).unref();
  });

export const render = async (url: string, data: BrajmartInitialData) => {
  setInitialData(data);
  applyInitialData(data);
  const helmetContext: HelmetContext = {};
  const appHtml = await streamToString(url, helmetContext);
  const helmet = helmetContext.helmet;
  const head = helmet
    ? [helmet.title.toString(), helmet.priority.toString(), helmet.meta.toString(), helmet.link.toString(), helmet.script.toString()].join('\n')
    : '';
  return { appHtml, head };
};

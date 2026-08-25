import { Link, useParams } from 'react-router-dom';
import { ArrowLeft, Clock, MapPin, Navigation } from 'lucide-react';
import AnnouncementBar from '@/components/layout/AnnouncementBar';
import Footer from '@/components/layout/Footer';
import Navbar from '@/components/layout/Navbar';
import SEO from '@/components/seo/SEO';
import { ScrollReveal } from '@/components/ui/ScrollReveal';
import { brajDestinations } from '@/data/brajDestinations';
import { breadcrumbSchema } from '@/lib/seo';

const BrajDarshanPage = () => {
  const { slug } = useParams<{ slug: string }>();
  const destination = brajDestinations.find((d) => d.slug === slug);

  if (!destination) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="text-center">
          <h1 className="mb-4 font-cinzel text-2xl font-bold text-foreground">Destination Not Found</h1>
          <Link to="/" className="text-saffron hover:underline">Back to Home</Link>
        </div>
      </div>
    );
  }

  const otherDestinations = brajDestinations.filter((d) => d.slug !== slug);
  const path = `/braj-darshan/${destination.slug}`;

  return (
    <div className="min-h-screen bg-background">
      <SEO
        title={`${destination.name} Braj Darshan | Brajmart`}
        description={destination.shortDesc}
        path={path}
        image={destination.heroImage}
        schema={[
          breadcrumbSchema([
            { name: 'Home', path: '/' },
            { name: 'Braj Darshan', path: '/' },
            { name: destination.name, path },
          ]),
          {
            '@context': 'https://schema.org',
            '@type': 'TouristDestination',
            name: destination.name,
            description: destination.fullDesc,
            image: destination.heroImage,
            url: `https://www.brajmart.com${path}`,
          },
        ]}
      />
      <AnnouncementBar />
      <Navbar />

      <div className="relative h-[42vh] min-h-[320px] overflow-hidden md:h-[52vh]">
        <img src={destination.heroImage} alt={destination.name} className="h-full w-full object-cover" />
        <div className="absolute inset-0 bg-gradient-to-t from-black/75 via-black/35 to-black/15" />
        <div className="absolute inset-x-0 bottom-0">
          <div className="container mx-auto px-4 pb-8 md:pb-12">
            <Link to="/" className="mb-5 inline-flex items-center gap-2 text-sm text-white/75 transition hover:text-white">
              <ArrowLeft size={15} /> Back to Home
            </Link>
            <p className="mb-2 text-xs font-semibold uppercase tracking-[0.22em] text-gold">Braj Darshan</p>
            <h1 className="max-w-3xl font-cinzel text-4xl font-bold leading-tight text-white md:text-6xl">
              {destination.name}
            </h1>
            <p className="mt-3 max-w-2xl text-sm leading-6 text-white/85 md:text-base">{destination.shortDesc}</p>
            <div className="mt-5 inline-flex items-center gap-2 rounded-full bg-white/12 px-4 py-2 text-sm text-white backdrop-blur">
              <MapPin size={14} />
              <span>{destination.distance}</span>
            </div>
          </div>
        </div>
      </div>

      <main className="container mx-auto px-4 py-8 md:py-12">
        <div className="mx-auto grid max-w-6xl gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
          <div className="space-y-8">
            <ScrollReveal>
              <section className="rounded-lg border border-border bg-card p-5 shadow-sm md:p-6">
                <p className="mb-2 text-xs font-semibold uppercase tracking-[0.18em] text-gold">Overview</p>
                <h2 className="mb-3 font-cinzel text-2xl font-bold text-foreground md:text-3xl">
                  A short guide to {destination.name}
                </h2>
                <p className="text-sm leading-7 text-muted-foreground md:text-base">{destination.fullDesc}</p>
              </section>
            </ScrollReveal>

            <ScrollReveal>
              <section>
                <h2 className="mb-4 font-cinzel text-xl font-bold text-foreground md:text-2xl">Key Places</h2>
                <div className="grid gap-3 sm:grid-cols-2">
                  {destination.famousTemples.map((temple) => (
                    <div key={temple} className="rounded-lg border border-border bg-card p-4">
                      <p className="font-medium text-foreground">{temple}</p>
                    </div>
                  ))}
                </div>
              </section>
            </ScrollReveal>

            <ScrollReveal>
              <section>
                <h2 className="mb-4 font-cinzel text-xl font-bold text-foreground md:text-2xl">Worth Doing</h2>
                <div className="grid gap-3 sm:grid-cols-2">
                  {destination.highlights.map((highlight) => (
                    <div key={highlight} className="flex items-start gap-3 rounded-lg bg-saffron/5 p-4 text-sm text-foreground">
                      <span className="mt-2 h-px w-4 shrink-0 bg-saffron" />
                      <span>{highlight}</span>
                    </div>
                  ))}
                </div>
              </section>
            </ScrollReveal>

            <ScrollReveal>
              <section>
                <h2 className="mb-4 font-cinzel text-xl font-bold text-foreground md:text-2xl">Nearby Braj Places</h2>
                <div className="flex flex-wrap gap-2">
                  {destination.nearbyPlaces.map((place) => (
                    <span key={place} className="rounded-full border border-border bg-card px-4 py-2 text-sm text-muted-foreground">
                      {place}
                    </span>
                  ))}
                </div>
              </section>
            </ScrollReveal>
          </div>

          <aside className="space-y-4 lg:sticky lg:top-32 lg:self-start">
            <ScrollReveal>
              <div className="rounded-lg border border-border bg-card p-5 shadow-sm">
                <div className="mb-3 flex items-center gap-2">
                  <Clock size={18} className="text-saffron" />
                  <h3 className="font-cinzel font-semibold text-foreground">Best Time</h3>
                </div>
                <p className="text-sm leading-6 text-muted-foreground">{destination.bestTimeToVisit}</p>
              </div>
            </ScrollReveal>

            <ScrollReveal delay={0.08}>
              <div className="rounded-lg border border-border bg-card p-5 shadow-sm">
                <div className="mb-3 flex items-center gap-2">
                  <Navigation size={18} className="text-saffron" />
                  <h3 className="font-cinzel font-semibold text-foreground">How to Reach</h3>
                </div>
                <p className="text-sm leading-6 text-muted-foreground">{destination.howToReach}</p>
              </div>
            </ScrollReveal>
          </aside>
        </div>

        <ScrollReveal>
          <section className="mx-auto mt-10 max-w-6xl">
            <div className="mb-5">
              <p className="mb-1 text-xs font-semibold uppercase tracking-[0.18em] text-gold">Continue Exploring</p>
              <h2 className="font-cinzel text-xl font-bold text-foreground md:text-2xl">Other Braj Destinations</h2>
            </div>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
              {otherDestinations.map((d) => (
                <Link
                  key={d.id}
                  to={`/braj-darshan/${d.slug}`}
                  className="group overflow-hidden rounded-lg border border-border bg-card transition hover:border-saffron/40 hover:shadow-md"
                >
                  <div className="aspect-[4/3] overflow-hidden">
                    <img
                      src={d.image}
                      alt={d.name}
                      className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
                      loading="lazy"
                    />
                  </div>
                  <div className="p-3">
                    <p className="font-cinzel text-sm font-semibold text-foreground">{d.name}</p>
                    <p className="mt-1 line-clamp-2 text-xs leading-5 text-muted-foreground">{d.shortDesc}</p>
                  </div>
                </Link>
              ))}
            </div>
          </section>
        </ScrollReveal>
      </main>

      <Footer />
    </div>
  );
};

export default BrajDarshanPage;

import { useParams, Link } from 'react-router-dom';
import { brajDestinations } from '@/data/brajDestinations';
import Navbar from '@/components/layout/Navbar';
import Footer from '@/components/layout/Footer';
import AnnouncementBar from '@/components/layout/AnnouncementBar';
import { ScrollReveal } from '@/components/ui/ScrollReveal';
import { MapPin, Clock, Navigation, Star, ArrowLeft } from 'lucide-react';
import SEO from '@/components/seo/SEO';
import { breadcrumbSchema } from '@/lib/seo';

const BrajDarshanPage = () => {
  const { slug } = useParams<{ slug: string }>();
  const destination = brajDestinations.find((d) => d.slug === slug);

  if (!destination) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-cinzel font-bold text-foreground mb-4">Destination Not Found</h1>
          <Link to="/" className="text-saffron hover:underline">← Back to Home</Link>
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

      {/* Hero */}
      <div className="relative h-[50vh] md:h-[60vh] overflow-hidden">
        <img src={destination.heroImage} alt={destination.name} className="w-full h-full object-cover" />
        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/40 to-transparent" />
        <div className="absolute bottom-0 left-0 right-0 p-6 md:p-12">
          <Link to="/" className="inline-flex items-center gap-1 text-white/70 hover:text-white text-sm mb-4 transition">
            <ArrowLeft size={14} /> Back to Home
          </Link>
          <div className="flex items-center gap-3 mb-2">
            <img src={destination.templeIcon} alt={`${destination.name} temple icon`} className="w-10 h-10 md:w-12 md:h-12 rounded-full object-cover border-2 border-white shadow-md" />
            <h1 className="font-cinzel text-3xl md:text-5xl font-bold text-white">{destination.name}</h1>
          </div>
          <div className="flex items-center gap-2 text-white/70 text-sm">
            <MapPin size={14} />
            <span>{destination.distance}</span>
          </div>
        </div>
      </div>

      <div className="container mx-auto px-4 py-10 md:py-16">
        <div className="max-w-4xl mx-auto">
          {/* About */}
          <ScrollReveal>
            <div className="mb-12">
              <h2 className="font-cinzel text-xl md:text-2xl font-bold text-foreground mb-4">
                About {destination.name}
              </h2>
              <p className="text-muted-foreground leading-relaxed">{destination.fullDesc}</p>
            </div>
          </ScrollReveal>

          {/* Info Cards */}
          <div className="grid md:grid-cols-2 gap-6 mb-12">
            <ScrollReveal>
              <div className="bg-card rounded-2xl border border-border p-6">
                <div className="flex items-center gap-2 mb-3">
                  <Clock size={18} className="text-saffron" />
                  <h3 className="font-cinzel font-semibold text-foreground">Best Time to Visit</h3>
                </div>
                <p className="text-muted-foreground text-sm">{destination.bestTimeToVisit}</p>
              </div>
            </ScrollReveal>
            <ScrollReveal delay={0.1}>
              <div className="bg-card rounded-2xl border border-border p-6">
                <div className="flex items-center gap-2 mb-3">
                  <Navigation size={18} className="text-saffron" />
                  <h3 className="font-cinzel font-semibold text-foreground">How to Reach</h3>
                </div>
                <p className="text-muted-foreground text-sm">{destination.howToReach}</p>
              </div>
            </ScrollReveal>
          </div>

          {/* Famous Temples */}
          <ScrollReveal>
            <div className="mb-12">
              <h2 className="font-cinzel text-xl md:text-2xl font-bold text-foreground mb-4">
                🛕 Famous Temples & Sacred Sites
              </h2>
              <div className="space-y-3">
                {destination.famousTemples.map((temple, i) => (
                  <div key={i} className="flex items-start gap-3 bg-card rounded-xl border border-border p-4">
                    <span className="text-saffron mt-0.5">
                      <Star size={14} fill="currentColor" />
                    </span>
                    <p className="text-muted-foreground text-sm">{temple}</p>
                  </div>
                ))}
              </div>
            </div>
          </ScrollReveal>

          {/* Highlights */}
          <ScrollReveal>
            <div className="mb-12">
              <h2 className="font-cinzel text-xl md:text-2xl font-bold text-foreground mb-4">
               Must-Do Highlights
              </h2>
              <div className="grid sm:grid-cols-2 gap-3">
                {destination.highlights.map((h, i) => (
                  <div key={i} className="flex items-center gap-2 bg-saffron/5 border border-saffron/10 rounded-xl p-3">
                    <span className="text-saffron text-sm">✓</span>
                    <span className="text-foreground text-sm">{h}</span>
                  </div>
                ))}
              </div>
            </div>
          </ScrollReveal>

          {/* Nearby Places */}
          <ScrollReveal>
            <div className="mb-12">
              <h2 className="font-cinzel text-xl md:text-2xl font-bold text-foreground mb-4">
                📍 Nearby Sacred Places
              </h2>
              <div className="flex flex-wrap gap-2">
                {destination.nearbyPlaces.map((p) => (
                  <span key={p} className="bg-card border border-border rounded-full px-4 py-2 text-sm text-muted-foreground">
                    {p}
                  </span>
                ))}
              </div>
            </div>
          </ScrollReveal>

          {/* Other Destinations */}
          <ScrollReveal>
            <div>
              <h2 className="font-cinzel text-xl md:text-2xl font-bold text-foreground mb-6">
                Explore Other Braj Destinations
              </h2>
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-3">
                {otherDestinations.map((d) => (
                  <Link
                    key={d.id}
                    to={`/braj-darshan/${d.slug}`}
                    className="block rounded-xl border border-border overflow-hidden hover:border-saffron/40 transition group"
                  >
                    <div className="aspect-square overflow-hidden relative">
                      <img src={d.image} alt={d.name} className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500" loading="lazy" />
                      <img
                        src={d.templeIcon}
                        alt={`${d.name} temple icon`}
                        className="absolute top-2 left-2 w-8 h-8 rounded-full object-cover border-2 border-white shadow-md"
                        loading="lazy"
                      />
                    </div>
                    <div className="p-2 text-center">
                      <p className="font-cinzel text-foreground text-xs font-semibold">{d.name}</p>
                    </div>
                  </Link>
                ))}
              </div>
            </div>
          </ScrollReveal>
        </div>
      </div>

      <Footer />
    </div>
  );
};

export default BrajDarshanPage;

import React, { useState, useCallback } from 'react';
import Card from '../../ui/shared/Card.jsx';

// ── Scene 3 Shot List — each shot gets a primary Unsplash query + Pinterest query ──
const SHOTS = [
  {
    id: '3A', time: '7:00 AM', block: 'MORNING B-ROLL', mustHave: true,
    title: 'Tahoe aerial — truck on trail below',
    desc: 'Drone wide of snowy mountain terrain, black truck + tan VW Vanagon winding through pine-lined trail. Sense of scale, isolation, adventure.',
    talent: false,
    unsplashQuery: 'aerial snow mountain road truck forest drone',
    pinterestQuery: 'overland truck snowy mountain trail aerial drone cinematic',
    artgridQueries: [
      'aerial drone truck snowy mountain trail pine trees winter',
      'overhead drone suv driving snow covered forest road cinematic',
      'lake tahoe aerial winter forest road drone',
    ],
  },
  {
    id: '3B', time: '8:00 AM', block: 'MORNING B-ROLL', mustHave: true,
    title: 'Truck on dirt trail — dust, golden light',
    desc: 'Low angle or tracking shot. Black truck and VW Vanagon kicking up dust/snow on backcountry trail. Golden backlit morning light flaring through trees.',
    talent: false,
    unsplashQuery: 'truck dirt road dust golden hour backlit adventure',
    pinterestQuery: 'overland truck dust trail golden hour backlit cinematic photography',
    artgridQueries: [
      'truck driving dirt road dust golden hour backlit cinematic',
      'off road vehicle snow trail sunrise lens flare slow motion',
      'VW vanagon overland camping trail driving',
    ],
  },
  {
    id: '3C', time: '9:00 AM', block: 'MORNING B-ROLL', mustHave: false,
    title: 'Interior POV — driving through terrain',
    desc: 'Dashboard POV from inside the truck. Hands on wheel, snowy trail ahead through windshield. Mountains visible.',
    talent: false,
    unsplashQuery: 'driving interior dashboard snow mountain road POV',
    pinterestQuery: 'truck interior POV driving snow mountain road cinematic windshield',
    artgridQueries: [
      'interior car dashboard POV driving snow mountain road cinematic',
      'hands steering wheel off road trail first person driving',
    ],
  },
  {
    id: '3D', time: '3:00 PM', block: 'TALENT', mustHave: true,
    title: 'Taylor grabs unit from truck bed',
    desc: 'Medium shot. Taylor reaches into black truck bed, grabs VitalLyfe unit. Natural, efficient motion — not staged. Rugged canvas jacket, hiking boots. Lake/mountains in BG.',
    talent: true,
    unsplashQuery: 'man grabbing gear pickup truck bed outdoor adventure mountains',
    pinterestQuery: 'man unloading gear truck bed campsite mountains rugged adventure',
    artgridQueries: [
      'man grabbing gear equipment from pickup truck bed outdoor adventure',
      'person unloading camping equipment truck tailgate mountains',
      'rugged man canvas jacket outdoor winter adventure lifestyle',
    ],
  },
  {
    id: '3E', time: '3:30 PM', block: 'TALENT', mustHave: true,
    title: 'Unit at alpine stream — water intake',
    desc: 'Product hero. VitalLyfe unit on mossy/snowy rock at stream edge. Intake hose in clear flowing water. Backlit, forest depth.',
    talent: true,
    unsplashQuery: 'alpine stream clear water rocks moss forest winter',
    pinterestQuery: 'portable water filter stream camping outdoor alpine creek cinematic',
    artgridQueries: [
      'alpine stream flowing water rocks moss snow forest close up',
      'person kneeling stream water outdoor adventure backcountry',
      'camping water filter stream outdoor gear cinematic',
    ],
  },
  {
    id: '3F', time: '4:00 PM', block: 'TALENT', mustHave: true,
    title: 'Wide — Taylor at water\'s edge, forest behind',
    desc: 'Wide establishing. Taylor crouched at stream edge, touching water. Quiet contemplative moment. Dense forest behind, afternoon light filtering through trees.',
    talent: true,
    unsplashQuery: 'person crouching stream forest wide shot golden light wilderness',
    pinterestQuery: 'man kneeling river water forest wide shot cinematic contemplative',
    artgridQueries: [
      'person crouching stream edge forest wide shot cinematic golden light',
      'man kneeling river touching water forest wilderness peaceful',
      'wide landscape person small in frame forest stream winter',
    ],
  },
  {
    id: '3G', time: '5:00 PM', block: 'TALENT', mustHave: false,
    title: 'Making camp — unit runs in background',
    desc: 'Taylor setting up tent near fire pit. Black truck + VW Vanagon parked. Unit on folding table running quietly. Golden hour light. Rooftop camper popped.',
    talent: true,
    unsplashQuery: 'campsite setup tent truck sunset golden hour mountains',
    pinterestQuery: 'overland camping setup tent vanagon truck fire pit golden hour',
    artgridQueries: [
      'man setting up tent campsite sunset golden hour mountains',
      'overland camping campsite truck vanagon tent fire pit golden hour',
      'rooftop tent truck camping setup wilderness evening',
    ],
  },
  {
    id: '3H', time: '5:30 PM', block: 'TALENT', mustHave: true,
    title: 'Hero product shot — glass of clean water on rock',
    desc: 'Tight hero. Crystal clear glass of water on natural rock surface. Golden hour backlight. Shallow DOF. Mountains/lake soft in BG.',
    talent: true,
    unsplashQuery: 'glass water rock sunset golden hour nature shallow depth',
    pinterestQuery: 'glass of water rock outdoor sunset golden hour product photography cinematic',
    artgridQueries: [
      'glass of water on rock outdoor sunset golden hour macro cinematic',
      'clear drinking water glass nature sunset shallow depth of field',
      'product shot beverage outdoor natural light rock surface',
    ],
  },
  {
    id: '3I', time: '6:30 PM', block: 'GOLDEN HOUR B-ROLL', mustHave: false,
    title: 'Campsite aerial — golden hour overhead',
    desc: 'Drone overhead of full campsite. Truck, Vanagon, tent, fire pit — all visible from above. Golden hour smoke/steam rising. Pine trees framing.',
    talent: false,
    unsplashQuery: 'campsite aerial overhead golden hour forest smoke camping',
    pinterestQuery: 'campsite aerial drone overhead golden hour smoke forest clearing',
    artgridQueries: [
      'aerial drone campsite overhead golden hour smoke fire camping',
      'overhead drone camping clearing forest vehicles tent sunset',
    ],
  },
  {
    id: '3J', time: '8:30 PM', block: 'EVENING B-ROLL', mustHave: false,
    title: 'Night — stars, tent glow, unit LED',
    desc: 'Wide night shot. Starry sky, tent glowing warm from inside. VitalLyfe unit LED (blue) glowing softly beside tent. Vanagon and truck silhouettes.',
    talent: false,
    unsplashQuery: 'camping tent night stars milky way glow',
    pinterestQuery: 'camping tent glow night stars milky way campsite cinematic',
    artgridQueries: [
      'night camping tent glow stars milky way cinematic wide',
      'campsite night starry sky tent illuminated vehicles silhouette',
      'LED glow night outdoor equipment camping blue light',
    ],
  },
];

const BLOCK_COLOR = {
  'MORNING B-ROLL': '#f59e0b',
  'TALENT': '#2AABFF',
  'GOLDEN HOUR B-ROLL': '#ff9f0a',
  'EVENING B-ROLL': '#5e5ce6',
};

// ── Photo Grid Component ──
function PhotoGrid({ photos, loading, error }) {
  if (loading) return (
    <div style={{ padding: '24px 0' }}>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10 }}>
        {[...Array(9)].map((_, i) => (
          <div key={i} style={{ aspectRatio: '16/10', borderRadius: 10, background: 'rgba(255,255,255,0.04)', animation: 'pulse 1.5s ease-in-out infinite', animationDelay: `${i * 0.1}s` }} />
        ))}
      </div>
    </div>
  );
  if (error) return <div style={{ padding: '16px 0', fontSize: 12, color: '#ff453a' }}>{error}</div>;
  if (!photos || photos.length === 0) return null;

  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10 }}>
      {photos.map(p => (
        <a key={p.id} href={p.link} target="_blank" rel="noopener noreferrer" style={{ position: 'relative', borderRadius: 10, overflow: 'hidden', aspectRatio: '16/10', display: 'block' }}>
          <img
            src={p.thumb}
            alt={p.alt}
            loading="lazy"
            style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block', transition: 'transform 0.3s' }}
            onMouseEnter={e => e.currentTarget.style.transform = 'scale(1.05)'}
            onMouseLeave={e => e.currentTarget.style.transform = 'scale(1)'}
          />
          <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, padding: '16px 10px 8px', background: 'linear-gradient(transparent, rgba(0,0,0,0.7))', pointerEvents: 'none' }}>
            <div style={{ fontSize: 9, color: 'rgba(255,255,255,0.7)', fontWeight: 500 }}>{p.photographer}</div>
          </div>
        </a>
      ))}
    </div>
  );
}

export default function ShotRefScout() {
  const [expanded, setExpanded] = useState({});
  const [photos, setPhotos] = useState({});    // { shotId: { photos, loading, error } }
  const [customQuery, setCustomQuery] = useState({});  // per-shot custom search input

  const toggle = useCallback((id) => {
    setExpanded(prev => ({ ...prev, [id]: !prev[id] }));
  }, []);

  // Fetch photos from Unsplash for a shot
  const fetchPhotos = useCallback(async (shotId, query) => {
    setPhotos(prev => ({ ...prev, [shotId]: { photos: [], loading: true, error: null } }));
    try {
      const res = await fetch(`/api/unsplash?q=${encodeURIComponent(query)}&per_page=9`);
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      setPhotos(prev => ({ ...prev, [shotId]: { photos: data.photos || [], loading: false, error: null } }));
    } catch (err) {
      setPhotos(prev => ({ ...prev, [shotId]: { photos: [], loading: false, error: err.message } }));
    }
  }, []);

  // Auto-fetch when expanding a shot for the first time
  const handleToggle = useCallback((shot) => {
    const willOpen = !expanded[shot.id];
    toggle(shot.id);
    if (willOpen && !photos[shot.id]) {
      fetchPhotos(shot.id, shot.unsplashQuery);
    }
  }, [expanded, photos, toggle, fetchPhotos]);

  const mustHaveCount = SHOTS.filter(s => s.mustHave).length;
  const talentCount = SHOTS.filter(s => s.talent).length;

  return (
    <div style={{ animation: 'fadeIn 0.4s ease' }}>
      <style>{`
        @keyframes pulse { 0%,100% { opacity: 0.3; } 50% { opacity: 0.6; } }
      `}</style>

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 8 }}>
        <div>
          <h1 style={{ fontFamily: "'Instrument Serif', Georgia, serif", fontSize: 32, fontWeight: 700, color: '#f5f5f7', marginBottom: 4, letterSpacing: -1 }}>
            Shot Reference Scout
          </h1>
          <p style={{ fontSize: 12, color: 'rgba(255,255,255,0.5)', margin: 0 }}>
            Scene 3: Overland — Lake Tahoe — Saturday March 21 — Click any shot to pull reference photos
          </p>
        </div>
        <div style={{ textAlign: 'right' }}>
          <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)' }}>Call Time 3:00 PM</div>
          <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)' }}>Wrap 7:00 PM</div>
        </div>
      </div>

      {/* Stats */}
      <Card style={{ padding: '14px 20px', marginBottom: 20, marginTop: 16, background: 'rgba(42,171,255,0.04)', border: '1px solid rgba(42,171,255,0.12)' }}>
        <div style={{ display: 'flex', gap: 32, alignItems: 'center' }}>
          <div>
            <div style={{ fontSize: 9, fontWeight: 700, color: 'rgba(255,255,255,0.35)', letterSpacing: 1.5, textTransform: 'uppercase' }}>Total Shots</div>
            <div style={{ fontSize: 20, fontWeight: 700, color: '#f5f5f7' }}>{SHOTS.length}</div>
          </div>
          <div>
            <div style={{ fontSize: 9, fontWeight: 700, color: 'rgba(255,255,255,0.35)', letterSpacing: 1.5, textTransform: 'uppercase' }}>Must Have</div>
            <div style={{ fontSize: 20, fontWeight: 700, color: '#10b981' }}>{mustHaveCount}</div>
          </div>
          <div>
            <div style={{ fontSize: 9, fontWeight: 700, color: 'rgba(255,255,255,0.35)', letterSpacing: 1.5, textTransform: 'uppercase' }}>Talent Shots</div>
            <div style={{ fontSize: 20, fontWeight: 700, color: '#2AABFF' }}>{talentCount}</div>
          </div>
          <div style={{ flex: 1 }} />
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            {Object.entries(BLOCK_COLOR).map(([block, color]) => (
              <span key={block} style={{ fontSize: 9, fontWeight: 600, color, background: `${color}15`, padding: '3px 10px', borderRadius: 6 }}>{block}</span>
            ))}
          </div>
        </div>
      </Card>

      {/* Crew */}
      <Card style={{ padding: '14px 20px', marginBottom: 20, background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)' }}>
        <div style={{ fontSize: 9, fontWeight: 700, color: 'rgba(255,255,255,0.35)', letterSpacing: 1.5, textTransform: 'uppercase', marginBottom: 10 }}>Crew</div>
        <div style={{ display: 'flex', gap: 20, flexWrap: 'wrap' }}>
          {[
            { name: 'Danny', role: 'DP', color: '#2AABFF' },
            { name: 'Chris', role: 'CAM B', color: '#2AABFF' },
            { name: 'Sebastian', role: 'GAFFER', color: '#f59e0b' },
            { name: 'Ray', role: 'PRODUCER', color: '#10b981' },
            { name: 'Max', role: 'PA', color: '#8b5cf6' },
            { name: 'Taylor', role: 'TALENT', color: '#ff9f0a' },
          ].map(c => (
            <div key={c.name} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ fontSize: 12, fontWeight: 600, color: '#f5f5f7' }}>{c.name}</span>
              <span style={{ fontSize: 9, fontWeight: 700, color: c.color, background: `${c.color}15`, padding: '2px 8px', borderRadius: 6 }}>{c.role}</span>
            </div>
          ))}
        </div>
      </Card>

      {/* Shot cards */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        {SHOTS.map(shot => {
          const isOpen = expanded[shot.id];
          const blockColor = BLOCK_COLOR[shot.block] || '#999';
          const shotPhotos = photos[shot.id];

          return (
            <Card key={shot.id} style={{ overflow: 'hidden' }}>
              {/* Shot header */}
              <div
                onClick={() => handleToggle(shot)}
                style={{ display: 'flex', alignItems: 'center', gap: 16, padding: '18px 22px', cursor: 'pointer' }}
              >
                <div style={{
                  width: 48, height: 48, borderRadius: 12,
                  background: shot.mustHave ? 'rgba(16,185,129,0.12)' : 'rgba(255,255,255,0.04)',
                  border: `1px solid ${shot.mustHave ? 'rgba(16,185,129,0.25)' : 'rgba(255,255,255,0.08)'}`,
                  display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
                }}>
                  <span style={{ fontSize: 16, fontWeight: 800, color: shot.mustHave ? '#10b981' : 'rgba(255,255,255,0.5)', letterSpacing: -0.5 }}>{shot.id}</span>
                </div>

                <div style={{ flex: 1 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                    {shot.mustHave && (
                      <span style={{ fontSize: 8, fontWeight: 800, color: '#10b981', background: 'rgba(16,185,129,0.12)', padding: '2px 8px', borderRadius: 6, letterSpacing: 1, textTransform: 'uppercase' }}>Must Have</span>
                    )}
                    <span style={{ fontSize: 9, fontWeight: 600, color: blockColor, background: `${blockColor}12`, padding: '2px 8px', borderRadius: 6 }}>{shot.block}</span>
                    <span style={{ fontSize: 9, color: 'rgba(255,255,255,0.4)', background: 'rgba(255,255,255,0.05)', padding: '2px 8px', borderRadius: 6 }}>{shot.time}</span>
                    {shot.talent && (
                      <span style={{ fontSize: 9, fontWeight: 600, color: '#ff9f0a', background: 'rgba(255,159,10,0.1)', padding: '2px 8px', borderRadius: 6 }}>Talent</span>
                    )}
                  </div>
                  <div style={{ fontSize: 14, fontWeight: 600, color: '#f5f5f7', letterSpacing: -0.2, marginBottom: 4 }}>{shot.title}</div>
                  <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.55)', lineHeight: 1.5, maxWidth: 600 }}>{shot.desc}</div>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
                  {shotPhotos?.photos?.length > 0 && (
                    <span style={{ fontSize: 10, color: '#10b981', fontWeight: 600 }}>{shotPhotos.photos.length} photos</span>
                  )}
                  <span style={{ fontSize: 14, color: 'rgba(255,255,255,0.3)', transform: isOpen ? 'rotate(180deg)' : 'rotate(0)', transition: 'transform 0.2s' }}>▾</span>
                </div>
              </div>

              {/* Expanded panel */}
              {isOpen && (
                <div style={{ borderTop: '1px solid rgba(255,255,255,0.06)', padding: '20px 22px' }}>

                  {/* Unsplash photos */}
                  <div style={{ marginBottom: 20 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                      <div style={{ fontSize: 9, fontWeight: 700, color: 'rgba(255,255,255,0.35)', letterSpacing: 1.5, textTransform: 'uppercase' }}>Unsplash References</div>
                      <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                        <button
                          onClick={(e) => { e.stopPropagation(); fetchPhotos(shot.id, shot.unsplashQuery); }}
                          style={{ background: 'none', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 8, color: 'rgba(255,255,255,0.5)', cursor: 'pointer', padding: '5px 12px', fontSize: 10, fontWeight: 600, fontFamily: 'Inter,sans-serif' }}
                        >
                          Refresh
                        </button>
                      </div>
                    </div>
                    <PhotoGrid
                      photos={shotPhotos?.photos}
                      loading={shotPhotos?.loading}
                      error={shotPhotos?.error}
                    />
                  </div>

                  {/* Custom search */}
                  <div style={{ marginBottom: 20 }}>
                    <div style={{ display: 'flex', gap: 8 }}>
                      <input
                        type="text"
                        placeholder="Search for something specific..."
                        value={customQuery[shot.id] || ''}
                        onChange={e => setCustomQuery(prev => ({ ...prev, [shot.id]: e.target.value }))}
                        onKeyDown={e => { if (e.key === 'Enter' && customQuery[shot.id]?.trim()) fetchPhotos(shot.id, customQuery[shot.id]); }}
                        onClick={e => e.stopPropagation()}
                        style={{
                          flex: 1, background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)',
                          borderRadius: 10, padding: '10px 14px', color: '#f5f5f7', fontSize: 12, fontFamily: 'Inter,sans-serif',
                          outline: 'none',
                        }}
                      />
                      <button
                        onClick={(e) => { e.stopPropagation(); if (customQuery[shot.id]?.trim()) fetchPhotos(shot.id, customQuery[shot.id]); }}
                        style={{
                          background: '#2AABFF', border: 'none', borderRadius: 10, color: '#fff', cursor: 'pointer',
                          padding: '10px 18px', fontSize: 12, fontWeight: 600, fontFamily: 'Inter,sans-serif', whiteSpace: 'nowrap',
                        }}
                      >
                        Search Unsplash
                      </button>
                    </div>
                  </div>

                  {/* Quick links: Pinterest + Artgrid */}
                  <div>
                    <div style={{ fontSize: 9, fontWeight: 700, color: 'rgba(255,255,255,0.35)', letterSpacing: 1.5, textTransform: 'uppercase', marginBottom: 10 }}>Open in Pinterest / Artgrid</div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                      {/* Pinterest link */}
                      <a
                        href={`https://pinterest.com/search/pins/?q=${encodeURIComponent(shot.pinterestQuery)}`}
                        target="_blank" rel="noopener noreferrer"
                        onClick={e => e.stopPropagation()}
                        style={{
                          display: 'flex', alignItems: 'center', gap: 12, padding: '11px 14px',
                          background: 'rgba(230,0,35,0.04)', border: '1px solid rgba(230,0,35,0.12)',
                          borderRadius: 10, textDecoration: 'none', transition: 'border-color 0.15s',
                        }}
                        onMouseEnter={e => e.currentTarget.style.borderColor = 'rgba(230,0,35,0.35)'}
                        onMouseLeave={e => e.currentTarget.style.borderColor = 'rgba(230,0,35,0.12)'}
                      >
                        <span style={{ fontSize: 8, fontWeight: 700, letterSpacing: 0.5, color: '#E60023', background: 'rgba(230,0,35,0.1)', padding: '3px 8px', borderRadius: 6, textTransform: 'uppercase' }}>Pinterest</span>
                        <span style={{ fontSize: 12, fontWeight: 600, color: '#f5f5f7', flex: 1 }}>{shot.pinterestQuery}</span>
                        <span style={{ fontSize: 11, color: '#E60023' }}>↗</span>
                      </a>

                      {/* Artgrid links */}
                      {shot.artgridQueries.map((q, i) => (
                        <a
                          key={i}
                          href={`https://artgrid.io/search?q=${encodeURIComponent(q)}`}
                          target="_blank" rel="noopener noreferrer"
                          onClick={e => e.stopPropagation()}
                          style={{
                            display: 'flex', alignItems: 'center', gap: 12, padding: '11px 14px',
                            background: 'rgba(42,171,255,0.03)', border: '1px solid rgba(42,171,255,0.08)',
                            borderRadius: 10, textDecoration: 'none', transition: 'border-color 0.15s',
                          }}
                          onMouseEnter={e => e.currentTarget.style.borderColor = 'rgba(42,171,255,0.3)'}
                          onMouseLeave={e => e.currentTarget.style.borderColor = 'rgba(42,171,255,0.08)'}
                        >
                          <span style={{ fontSize: 8, fontWeight: 700, letterSpacing: 0.5, color: '#2AABFF', background: 'rgba(42,171,255,0.1)', padding: '3px 8px', borderRadius: 6, textTransform: 'uppercase' }}>Artgrid</span>
                          <span style={{ fontSize: 12, fontWeight: 600, color: '#f5f5f7', flex: 1 }}>{q}</span>
                          <span style={{ fontSize: 11, color: '#2AABFF' }}>↗</span>
                        </a>
                      ))}
                    </div>
                  </div>

                </div>
              )}
            </Card>
          );
        })}
      </div>
    </div>
  );
}

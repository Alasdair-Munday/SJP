#!/bin/bash

# 1. Create Directories
mkdir -p src/components src/layouts src/pages src/data

# 2. Create the Data File (content.json)
cat <<EOF > src/data/content.json
{
  "site": {
    "title": "St Johns Park",
    "subtitle": "Common Ground. Holy Ground.",
    "address": "Bernard Street, Sheffield, S2 5PU",
    "mission": "Belong, Serve, Give",
    "vision": "Eden in the Park"
  },
  "navigation": [
    { "label": "Sundays", "href": "/sundays" },
    { "label": "What's On", "href": "/whats-on" },
    { "label": "The Park", "href": "/the-park" },
    { "label": "Team", "href": "/team" },
    { "label": "Contact", "href": "/contact" }
  ],
  "pages": {
    "home": {
      "hero": {
        "title": "EDEN IN THE CONCRETE",
        "subtitle": "A sanctuary between the towers. Real people. Real hope. No pretense.",
        "badge": "Welcome to the neighborhood"
      },
      "mission_grid": [
        {
          "title": "BELONG",
          "desc": "Don't fit in? Good. You belong here. Join the chaos of God's family.",
          "link_text": "SUNDAYS @ 10:45",
          "link_href": "/sundays",
          "color": "teal"
        },
        {
          "title": "SERVE",
          "desc": "Roll up your sleeves. We dig gardens, run foodbanks, and feed neighbors.",
          "link_text": "JOIN A TEAM",
          "link_href": "/serve",
          "color": "green"
        },
        {
          "title": "GIVE",
          "desc": "All in. We give our time, money, and lives to the mission.",
          "link_text": "SUPPORT THE VISION",
          "link_href": "/give",
          "color": "gold"
        }
      ]
    },
    "sundays": {
      "time": "10:45 AM",
      "location": "The Park Entrance",
      "description": "Our Sunday gathering is informal, interactive, and all-age. We gather to worship Jesus, hear the Bible read and explained, and to pray. We have kids and youth groups (0-14) that meet during our service.",
      "kids_blurb": "Kids & Youth (0-14) groups meet during the service."
    }
  }
}
EOF

# 3. Create the Logo Component
cat <<EOF > src/components/Logo.astro
---
interface Props {
  class?: string;
}
const { class: className } = Astro.props;
---
<svg viewBox="0 0 100 100" class={className} fill="none" xmlns="http://www.w3.org/2000/svg">
  <!-- The "Box" container -->
  <rect width="100" height="100" fill="transparent" />
  
  <!-- The Church Outline - Thicker, sharper lines -->
  <path 
    d="M10 80 H90 V50 L75 35 V80 M75 35 L50 10 L25 35 V80" 
    stroke="currentColor" 
    stroke-width="6" 
    stroke-linejoin="round"
    stroke-linecap="square" 
  />
  <!-- Vertical Lines (The Windows) -->
  <path d="M35 80 V55" stroke="currentColor" stroke-width="4" />
  <path d="M45 80 V55" stroke="currentColor" stroke-width="4" />
  <path d="M55 80 V55" stroke="currentColor" stroke-width="4" />
  <path d="M65 80 V55" stroke="currentColor" stroke-width="4" />
  
  <!-- The Door/Arch Detail -->
  <path d="M50 80 V65" stroke="currentColor" stroke-width="4" />
</svg>
EOF

# 4. Create the Main Layout (With Kingdom Gold)
cat <<EOF > src/layouts/Layout.astro
---
import Logo from '../components/Logo.astro';
import content from '../data/content.json';
import '../styles/global.css';

interface Props {
	title: string;
}

const { title } = Astro.props;
---

<!doctype html>
<html lang="en">
	<head>
		<meta charset="UTF-8" />
		<meta name="description" content="St Johns Park Church" />
		<meta name="viewport" content="width=device-width" />
		<link rel="icon" type="image/svg+xml" href="/favicon.svg" />
		<link rel="preconnect" href="https://fonts.googleapis.com">
		<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
		<link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;600;800&display=swap" rel="stylesheet">
		<title>{title} | {content.site.title}</title>
	</head>
	<body class="bg-[#F4F4F0] font-sans text-[#0F2830]">
		
		<!-- UTILITY BAR -->
		<div class="bg-[#0F2830] text-white text-xs font-bold py-3 px-4 uppercase tracking-widest text-center flex justify-center gap-6">
			<span class="flex items-center gap-2"><span class="text-[#45B074]">●</span> Belong</span>
			<span class="flex items-center gap-2"><span class="text-[#F0B323]">●</span> Serve</span>
			<span class="flex items-center gap-2"><span class="text-[#F0B323]">●</span> Give</span>
		</div>

		<!-- NAVIGATION -->
		<nav class="bg-white border-b-[3px] border-[#0F2830] sticky top-0 z-50">
			<div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
				<div class="flex justify-between h-20 items-center">
					
					<!-- LOGO -->
					<a href="/" class="flex-shrink-0 flex items-center gap-4 group">
						<div class="w-12 h-12 text-[#0F2830] group-hover:text-[#45B074] transition-colors">
							<Logo class="w-full h-full" />
						</div>
						<div class="leading-none">
							<span class="block font-extrabold text-xl tracking-tight uppercase text-[#0F2830]">ST. JOHN'S</span>
							<span class="block font-bold text-xl tracking-[0.2em] text-[#45B074] -mt-1 uppercase">PARK</span>
						</div>
					</a>

					<!-- DESKTOP MENU -->
					<div class="hidden md:flex items-center gap-1">
						{content.navigation.map((item) => (
							<a href={item.href} class="text-[#0F2830] font-bold uppercase text-sm tracking-wide hover:bg-[#E8E8E0] px-4 py-2 transition-colors">
								{item.label}
							</a>
						))}
						<!-- THE GOLDEN TICKET BUTTON -->
						<a href="/sundays" class="ml-4 bg-[#F0B323] text-[#0F2830] px-6 py-2.5 font-extrabold uppercase text-sm tracking-widest border-[3px] border-[#0F2830] hover:bg-white hover:text-[#0F2830] transition-all shadow-[4px_4px_0px_0px_#0F2830] active:translate-y-1 active:shadow-none">
							I'm New
						</a>
					</div>
				</div>
			</div>
		</nav>

		<slot />

		<!-- FOOTER -->
		<footer class="bg-[#0F2830] text-white py-16 mt-auto border-t-[8px] border-[#F0B323]">
			<div class="max-w-7xl mx-auto px-4 grid md:grid-cols-2 gap-12">
				<div>
					<div class="w-16 h-16 text-[#F0B323] mb-6">
						<Logo class="w-full h-full" />
					</div>
					<h3 class="text-2xl font-bold uppercase tracking-widest mb-2">St. John's Park</h3>
					<p class="text-gray-400 max-w-sm">{content.site.address}</p>
				</div>
				<div class="md:text-right">
					<p class="font-bold text-[#45B074] uppercase tracking-widest mb-4">Quick Links</p>
					<div class="flex flex-col md:items-end gap-2 text-gray-300">
						<a href="#" class="hover:text-white hover:underline decoration-[#F0B323] underline-offset-4">Safeguarding Policy (PDF)</a>
						<a href="#" class="hover:text-white hover:underline decoration-[#F0B323] underline-offset-4">Data Privacy</a>
						<a href="#" class="hover:text-white hover:underline decoration-[#F0B323] underline-offset-4">ChurchSuite Login</a>
					</div>
				</div>
			</div>
		</footer>
	</body>
</html>
EOF

# 5. Create the Homepage
cat <<EOF > src/pages/index.astro
---
import Layout from '../layouts/Layout.astro';
import Logo from '../components/Logo.astro';
import content from '../data/content.json';
import { ArrowRight, Users, Zap, Heart, MapPin, Calendar } from 'lucide-react';

const { hero, mission_grid } = content.pages.home;
---

<Layout title="Home">
	
	<!-- HERO SECTION -->
	<div class="relative bg-[#E8E8E0] text-[#0F2830] overflow-hidden border-b-[3px] border-[#0F2830]">
		
		<!-- Watermark Background Logo -->
		<div class="absolute -right-20 -bottom-20 w-[600px] h-[600px] text-[#0F2830] opacity-[0.03]">
			<Logo class="w-full h-full" />
		</div>
		
		<div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20 md:py-28 relative z-10">
			<div class="max-w-3xl">
				<!-- Tag -->
				<div class="inline-block border-[3px] border-[#0F2830] px-4 py-2 font-bold uppercase tracking-widest text-xs mb-8 bg-white shadow-[6px_6px_0px_0px_#45B074] text-[#0F2830]">
					{hero.badge}
				</div>
				
				<!-- Headline with Color Triad -->
				<h1 class="text-5xl md:text-7xl font-extrabold tracking-tight uppercase leading-[0.95] mb-6">
					<span class="text-[#45B074]">Eden</span> in the <br />
					<span class="text-[#0F2830]">Concrete.</span>
				</h1>
				
				<p class="text-xl md:text-2xl font-medium text-[#0F2830]/80 max-w-xl leading-relaxed mb-10 border-l-[6px] border-[#F0B323] pl-8 py-2">
					{hero.subtitle}
				</p>
				
				<div class="flex flex-wrap gap-4">
					<a href="/sundays" class="px-8 py-4 bg-[#0F2830] text-white font-bold uppercase tracking-widest border-[3px] border-[#0F2830] hover:bg-[#45B074] hover:border-[#45B074] transition-all flex items-center gap-3 shadow-[6px_6px_0px_0px_#F0B323] hover:translate-y-1 hover:shadow-none">
						Visit Sunday <ArrowRight size={20} />
					</a>
					<a href="/the-park" class="px-8 py-4 bg-white text-[#0F2830] font-bold uppercase tracking-widest border-[3px] border-[#0F2830] hover:bg-[#F0B323] transition-all flex items-center gap-3">
						Park Access <MapPin size={20} />
					</a>
				</div>
			</div>
		</div>
	</div>

	<!-- BANNER: Upcoming -->
	<div class="bg-[#F0B323] border-b-[3px] border-[#0F2830] p-4">
		<div class="max-w-7xl mx-auto flex flex-col md:flex-row items-center justify-between gap-4 text-[#0F2830]">
			<div class="flex items-center gap-3">
				<Calendar className="w-6 h-6" />
				<span class="font-bold uppercase tracking-wider">Coming Up: </span>
				<span class="font-bold">Easter Service & Community Lunch</span>
			</div>
			<a href="#" class="font-bold underline underline-offset-4 hover:text-white transition-colors">View Details -></a>
		</div>
	</div>

	<!-- MISSION GRID -->
	<div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20">
		<div class="flex items-end gap-4 mb-12 border-b-[3px] border-[#0F2830] pb-4">
			<h2 class="text-4xl font-extrabold uppercase tracking-tight text-[#0F2830]">Our Mission</h2>
			<span class="mb-2 font-mono text-sm text-[#0F2830]/60 hidden md:inline-block">// Belong, Serve, Give</span>
		</div>

		<div class="grid grid-cols-1 md:grid-cols-3 gap-8">
			
			{/* CARD 1: BELONG (Teal Accent) */}
			<div class="bg-white border-[3px] border-[#0F2830] p-8 hover:-translate-y-2 transition-transform duration-300 shadow-[8px_8px_0px_0px_#E8E8E0] hover:shadow-[8px_8px_0px_0px_#0F2830] group">
				<div class="w-12 h-12 bg-[#E8E8E0] text-[#0F2830] flex items-center justify-center mb-6 group-hover:bg-[#0F2830] group-hover:text-white transition-colors">
					<Users size={24} />
				</div>
				<h3 class="text-2xl font-extrabold uppercase mb-3 text-[#0F2830]">Belong</h3>
				<p class="text-[#0F2830]/80 font-medium mb-8 leading-relaxed">
					Don't fit in? Good. You belong here. Join the chaos of God's family.
				</p>
				<a href="/sundays" class="inline-flex items-center gap-2 font-bold uppercase text-sm tracking-wider border-b-2 border-[#0F2830] pb-1 hover:text-[#45B074] hover:border-[#45B074] transition-colors">
					Sundays @ 10:45 <ArrowRight size={16} />
				</a>
			</div>

			{/* CARD 2: SERVE (Green Accent) */}
			<div class="bg-white border-[3px] border-[#0F2830] p-8 hover:-translate-y-2 transition-transform duration-300 shadow-[8px_8px_0px_0px_#E8E8E0] hover:shadow-[8px_8px_0px_0px_#45B074] group">
				<div class="w-12 h-12 bg-[#E8E8E0] text-[#0F2830] flex items-center justify-center mb-6 group-hover:bg-[#45B074] group-hover:text-white transition-colors">
					<Zap size={24} />
				</div>
				<h3 class="text-2xl font-extrabold uppercase mb-3 text-[#0F2830]">Serve</h3>
				<p class="text-[#0F2830]/80 font-medium mb-8 leading-relaxed">
					Roll up your sleeves. We dig gardens, run foodbanks, and feed neighbors.
				</p>
				<a href="/serve" class="inline-flex items-center gap-2 font-bold uppercase text-sm tracking-wider border-b-2 border-[#0F2830] pb-1 hover:text-[#45B074] hover:border-[#45B074] transition-colors">
					Join a Team <ArrowRight size={16} />
				</a>
			</div>

			{/* CARD 3: GIVE (KINGDOM GOLD) */}
			<div class="bg-[#F0B323] border-[3px] border-[#0F2830] p-8 hover:-translate-y-2 transition-transform duration-300 shadow-[8px_8px_0px_0px_#0F2830] group">
				<div class="w-12 h-12 bg-[#0F2830] text-[#F0B323] flex items-center justify-center mb-6">
					<Heart size={24} />
				</div>
				<h3 class="text-2xl font-extrabold uppercase mb-3 text-[#0F2830]">Give</h3>
				<p class="text-[#0F2830] font-bold mb-8 leading-relaxed">
					All in. We give our time, money, and lives to the mission.
				</p>
				<a href="/give" class="inline-flex items-center gap-2 font-extrabold uppercase text-sm tracking-wider border-b-2 border-[#0F2830] pb-1 text-[#0F2830] hover:text-white hover:border-white transition-colors">
					Support the Vision <ArrowRight size={16} />
				</a>
			</div>

		</div>
	</div>
</Layout>
EOF

# 6. Create the Sundays Page
cat <<EOF > src/pages/sundays.astro
---
import Layout from '../layouts/Layout.astro';
import content from '../data/content.json';
import { Clock, MapPin } from 'lucide-react';

const { sundays } = content.pages;
---

<Layout title="Sundays">
    <div class="max-w-4xl mx-auto px-4 py-20">
        
        <!-- Header -->
        <h1 class="text-6xl md:text-8xl font-black uppercase tracking-tighter mb-8 text-[#0F2830]">
            SUNDAY <br/>
            <span class="text-[#45B074]">GATHERING</span>
        </h1>

        <!-- Info Card -->
        <div class="bg-white border-[3px] border-[#0F2830] p-8 shadow-[8px_8px_0px_0px_#F0B323] mb-12">
            <div class="flex flex-col md:flex-row gap-8 mb-8 border-b-[3px] border-[#0F2830] pb-8">
                <div class="flex items-center gap-4">
                    <div class="bg-[#0F2830] text-white p-3">
                        <Clock size={32} />
                    </div>
                    <div>
                        <div class="font-bold text-sm uppercase text-gray-500">Time</div>
                        <div class="text-2xl font-black text-[#0F2830]">{sundays.time}</div>
                    </div>
                </div>
                <div class="flex items-center gap-4">
                    <div class="bg-[#0F2830] text-white p-3">
                        <MapPin size={32} />
                    </div>
                    <div>
                        <div class="font-bold text-sm uppercase text-gray-500">Location</div>
                        <div class="text-2xl font-black text-[#0F2830]">{sundays.location}</div>
                    </div>
                </div>
            </div>

            <div class="prose prose-xl prose-p:font-bold prose-p:text-[#0F2830] max-w-none">
                <p>{sundays.description}</p>
            </div>
        </div>

        <!-- Kids Section -->
        <div class="bg-[#45B074] border-[3px] border-[#0F2830] p-8 transform rotate-1">
            <h2 class="text-3xl font-black uppercase mb-4 text-[#0F2830]">Bringing Kids?</h2>
            <p class="font-bold text-xl text-[#0F2830]">{sundays.kids_blurb}</p>
        </div>

    </div>
</Layout>
EOF

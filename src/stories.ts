/**
 * The full story behind every deck and booth in Competitions & Hackathons: the problem, what we did,
 * the call that mattered, and what I took away. Keyed by deck file / exhibit id. Numbers come from the decks.
 */
export type Story = {
  problem: string;
  did: string[];
  call: string;
  learned: string;
  team?: string;
};

export const STORIES: Record<string, Story> = {
  blinkx: {
    problem: "BlinkX, JM Financial's stock-broking app launched in 2022, needed a push-notification strategy that brings users back and keeps them trading, without the notification fatigue that gets apps uninstalled.",
    did: [
      "Built three personas: a 21-year-old student investor in Bangalore, a 30-year-old small-business owner in Agra, and a 52-year-old business owner in Mumbai.",
      "Studied what works outside broking: Zomato's Hinglish, location-aware nudges, Amazon's personal recommendations, Duolingo's streaks.",
      "Segmented users four ways (income, market timing, location, trading data) and wrote notifications for each: market open, 52-week highs, portfolio wins.",
      "Wrote them in Hinglish with Bollywood lines (“Mogambo khush hua!” for a green day), and designed an NLP pipeline to generate them at scale.",
      "Planned a four-phase rollout from a beta group to everyone, judged on click-through, session time, retention and number of trades.",
    ],
    call: "Fewer, better notifications: frequency caps and user-chosen timing, with humour and regional language doing the work volume usually does.",
    learned: "Engagement comes from relevance and timing, not volume. The cap matters as much as the copy.",
    team: "Team NEXUS · Vaibhav Itauriya, Mukund Singhal, Sanket Bansal",
  },
  groww: {
    problem: "People can't see or cancel the auto-debits scattered across UPI, debit and credit cards. 92% want them managed in one place, and 37% admit to paying for subscriptions they don't use.",
    did: [
      "Wrote the persona: a 24-year-old engineer in Bangalore juggling OTT plans, EMIs and household services.",
      "Designed one dashboard inside Groww: every active mandate, one-click cancel, pause without cancelling, alerts before each debit and on low balance.",
      "Mapped the integration step by step for UPI AutoPay and for card mandates, with the user journey and tech stack.",
    ],
    call: "Add “pause” as the middle option between keep and cancel, and build it into Groww itself rather than another app to download.",
    learned: "A fintech feature that helps people spend less still grows the product: the trust is what brings them back.",
    team: "Product Club, IIT Kanpur · Team 5 Shades of Groww",
  },
  swiggy: {
    problem: "Make Swiggy the go-to food companion at IIT Kanpur. Small orders (~₹200) get eaten by delivery fees, students eat at canteens that aren't on Swiggy, and campus deliveries stop at 10 PM.",
    did: [
      "Sized the campus: ~5,500 students ordering, 1.5–2.2 orders a week each, about ₹3.3M a month in baseline potential.",
      "Designed CampusServe: pre-order from a canteen, a Bluetooth printer prints a QR slip, and the student gets a ping when it's ready, with a digital khata for regulars.",
      "Added an Instamart nudge to reach free delivery (about +15% order value) and campus dine-out offers timed to exam weeks.",
      "Ranked five initiatives by partners, complexity, time and cost, so the quick wins ship in under six weeks.",
    ],
    call: "Partner with the canteens inside campus instead of fighting the 10 PM delivery ban. It keeps Swiggy useful late at night.",
    learned: "The constraint was the opportunity. The rule that blocked delivery is what made the in-campus idea worth building.",
    team: "Team Chanakya · Mukund Singhal, Vaibhav Itauriya, Sanket Bansal, Dipanshu Raj",
  },
  bodyshop: {
    problem: "The Body Shop is strong in metros but thin in Tier 2 and 3 cities: premium prices, costly stores, cheaper natural brands like Mamaearth and Plum, and doubts about its ethics after the L'Oréal years.",
    did: [
      "Built two personas: an eco-conscious 28-year-old professional in Kanpur and a 20-year-old student trendsetter in Jodhpur.",
      "Benchmarked six competitors, from Mamaearth to HUL, for what each does better.",
      "Proposed five moves: salon partnerships with better margins, an “Every Purchase Empowers a Farmer” campaign, a male-grooming line, a low-cost sachet sub-brand for small towns, and refill stations.",
      "Laid out a four-quarter go-to-market plan with projected impact: +15% offline sales, +25% revenue in Tier 2/3.",
    ],
    call: "Reach small cities with smaller packs and a sub-brand, rather than discounting the main brand.",
    learned: "Taking a premium brand to new markets means changing the pack and the price point while protecting the name.",
    team: "Team Chanakya · Mukund Singhal, Vaibhav Itauriya, Kalpak Agrawal, Sanket Bansal, Mahi Mittal",
  },
  brainalive: {
    problem: "Launch FOCII, BrainAlive's YouTube extension that reads attention from eye movement and expressions, to creators before its Q3 2024 release. The aim was growth, not revenue, and the biggest barrier was privacy fear.",
    did: [
      "Wrote three personas: a creator with 3M subscribers, an online tutor teaching 25+ students a day, and a student paid in tokens for sharing viewing data.",
      "Answered the privacy worry first: webcam data never leaves the computer, and FOCII switches off in one click.",
      "Planned the go-to-market: creator partnerships, webinars, content, referrals and events.",
      "Scored every channel with RICE (reach, impact, confidence, effort) to decide the order.",
    ],
    call: "Let the RICE scores decide: partnerships first, then referrals, then content, instead of spreading effort across every channel.",
    learned: "For a product that watches you, trust is the first feature you have to sell.",
    team: "Product Club, IIT Kanpur · Mukund Singhal, Sanket Bansal, Dipanshu Raj",
  },
  spotify: {
    problem: "Raise Spotify Premium conversion in India.",
    did: [
      "Proposed five Premium features: mashups, audio modes (lo-fi, slowed, bass), reel-style song previews, karaoke recording and concert livestreams.",
      "Set the target: conversion from 10% to 20%, about 10M new paying users in a year.",
      "Priced for India: student, family and regional plans, plus bundles with Jio, Airtel and Vi.",
      "Launch in Mumbai and Delhi first, then Tier 2 and 3 with regional artists and a 90-day free trial.",
    ],
    call: "Bundle with telecom operators, so Premium reaches people through the bill they already pay.",
    learned: "In India, price and distribution move conversion as much as features do.",
  },
  sarcathon: {
    problem: "Government schools aren't preparing students for an AI-era workforce: outdated curriculum, overloaded teachers, missing labs, absenteeism, and a reputation that keeps parents away.",
    did: [
      "Went to the government school in Nankari, near IIT Kanpur, and spoke to the principal to see the problems first-hand.",
      "Studied Shiksha Sopan, the school run by HC Verma at IIT Kanpur, as the model to aim for.",
      "Wrote personas for a 13-year-old girl on Kanpur's outskirts and a private-school student, to compare the gap.",
      "Proposed six fixes: AI classrooms with trained teaching assistants, IIT/NIT student internships to build labs and libraries, a success-story campaign, biometric attendance, offline tablets with attendance incentives, and science labs and campus tours.",
    ],
    call: "Visit the school before writing a single slide, and build the deck around what we saw there.",
    learned: "Field visits make the problem real. A desk-research deck would have solved a different, easier problem.",
    team: "Team Chanakya · Mukund Singhal, Sanket Bansal, Kalpak Agrawal, Vaibhav Itauriya",
  },
  prodmad: {
    problem: "Hospitals that use bio-printed organs struggle to schedule surgery around organ readiness and to monitor patients after the transplant, while patients wait in uncertainty.",
    did: [
      "Wrote personas on both sides: a 49-year-old kidney patient in Kanpur and a transplant hospital in New Delhi.",
      "Designed BioMorph: live tracking of the organ being printed, alerts for readiness and appointments, doctor chat and video, and recovery milestones.",
      "Built a Figma prototype with separate patient and doctor flows.",
      "Planned pilots with 3–5 top hospitals before Tier 2 and 3, on tiered subscriptions, measured by compatibility, adherence and patient trust.",
    ],
    call: "One app with two sides, patient and hospital, because both have to trust the same timeline.",
    learned: "Even in a futuristic case, the human problem, waiting and anxiety, is the product.",
    team: "Team Innovators · Mukund Singhal, Vaibhav Itauriya, Mahi Mittal",
  },
  meesho: {
    problem: "Brands spend ~₹5,400 Cr a year putting samples in Indian homes and learn almost nothing back: no name, no response, no purchase signal. Small towns go unreached because a promoter contact costs ₹25–40.",
    did: [
      "Led team Moshi Moshi. We ran four recorded brand interviews and a 62-buyer survey: 79% liked the idea and 84% would answer questions for a sample.",
      "Sized it three independent ways (category spend, users, parcels) to a ₹650 Cr run-rate by FY28, about 1% of Meesho's sales.",
      "Designed the loop: flag opted-in orders, put the sample in the parcel, she scans a QR, answers three questions and gets ₹15 off, and a 90-day holdout proves whether she bought.",
      "Costed five ways to pack it and showed 60% cheaper launches with 200× the feedback. Planned a ₹46 lakh, 90-day pilot with a kill gate at every step.",
      "Built the clickable prototype: buyer opt-in to coupon, plus the brand console.",
    ],
    call: "Sell the feedback, not the reach: ₹13 per trial to the brand, ₹0 for sellers and buyers. And every number is either sourced or a labelled assumption that the pilot tests.",
    learned: "A big number is only believable when you also say what would kill it.",
    team: "Team Moshi Moshi · Mukund Singhal (team lead), Vaibhav Itauriya, Karmanya Goyal",
  },
  sarvam: {
    problem: "The Sarvam AI hackathon brief: build a working AI agent from scratch, against the clock. 45 minutes, start to demo.",
    did: [
      "Picked one job for the agent and built it end to end in the time.",
      "Deployed it as a live app the judges could use, not just a demo video.",
      "Took 2nd place.",
    ],
    call: "With 45 minutes on the clock, cut the scope to one thing that works end to end, then polish that.",
    learned: "Under a deadline, a small thing that works beats a big thing that almost does.",
  },
  pacto: {
    problem: "People sign up for the gym or a study plan and quietly stop showing up. Reminders get ignored.",
    did: [
      "Led the team that built Pacto, an AI agent you talk to by voice or chat, in Hinglish, that holds you to what you said you'd do.",
      "Ran an 8-person pilot: regular no-shows turned into near-daily attendance.",
      "Put the prompts through 18 rounds of testing with real users before the final.",
      "Reached the national final of The Ken × Zerodha 2026.",
    ],
    call: "Spend the time on 18 rounds of prompt testing with real users instead of adding features.",
    learned: "Accountability sticks when it sounds like a friend in Hinglish, not like a reminder app.",
  },
};

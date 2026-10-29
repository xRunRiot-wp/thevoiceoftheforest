// Campaign content, taken from the GM's Google Site, Drive handouts and guides.
// Spreadsheet data (party, items, moves, abilities) is loaded separately in sheetdata.js.

export const LINKS = {
  site: 'https://sites.google.com/view/dungeoncrawling/home',
  roll20: 'https://app.roll20.net/join/22022215/4cbasA',
  tabletop: 'https://xrunriot-wp.github.io/programs/tabletop/',
  handouts: 'https://drive.google.com/drive/folders/1e2VGoj3l5cp0Y9RJrDrtkM4shZtL23pB?usp=drive_link',
  sheet: 'https://docs.google.com/spreadsheets/d/1GK62Zcn61JNy0vdmDKp15SusSsJ0R2jaSuf_d5vJPoQ/edit?gid=311637711#gid=311637711',
  form: 'https://forms.gle/GYmxXLQ7a3rcVRoH6',
  charSheet: 'https://drive.google.com/file/d/1yCyJXdKwUSaAP_S1NtL7uYU1onJTWf9A/view?usp=drive_link',
  rulebook: 'https://drive.google.com/file/d/1vM2JUUlYeTRPLoyI00gaWg22DaFITtTT/view?usp=sharing',
  supplement: 'https://drive.google.com/file/d/1xFO1SyDxrVAqQX5-l7NbbSXQSR5Szsv1/view',
  quickRoll: 'https://drive.google.com/file/d/1KcI-QQvDrcpYCKC-1bxZLLfB_RJKALBD/view',
  lootGuide: 'https://drive.google.com/file/d/1c7URmVyVtipBO5x5PqSNqfN52DMX44dc/view',
  trailer: 'https://drive.google.com/file/d/1_-I2JomKeVQ1ysFSOy90M47mes8JJ8J4/view',
  discord: 'https://discord.gg/YKjQ3YFqk',
};

export const QUICK_LINKS = [
  { label: 'The Tabletop', sub: 'Maps, minis and dice for our sessions', href: LINKS.tabletop },
  { label: 'Join on Roll20', sub: 'Voice of the Forest table', href: LINKS.roll20 },
  { label: 'Background Form', sub: 'Who were you?', href: LINKS.form },
  { label: 'Character Sheet', sub: 'Monster Sheet 2.0 (make a copy)', href: LINKS.charSheet },
  { label: 'PokéRole Rulebook', sub: 'Version 2.0', href: LINKS.rulebook },
  { label: 'Mystery Dungeon Supplement', sub: 'Unofficial v2.0', href: LINKS.supplement },
  { label: 'Player Handouts', sub: 'Google Drive folder', href: LINKS.handouts },
  { label: 'Campaign Spreadsheet', sub: 'Guild tab, moves, abilities', href: LINKS.sheet },
  { label: 'Discord', sub: 'Talk to the table', href: LINKS.discord },
];

export const INTRO = {
  title: 'Voice of the Forest',
  tagline: 'Your adventure awaits...',
  body: [
    'The woodland is changing.',
    'Once-familiar paths now lead into unpredictable Mystery Dungeons. Violent tremors shake the land, fiery fissures divide entire regions, and Pokémon are disappearing without explanation. Even the great rescue guild can no longer protect every settlement calling for help.',
    'Into this growing crisis comes an unlikely team of Pokémon carrying fragmented memories, unanswered questions, and traces of lives they can barely remember. To survive, they must master their new abilities, build trust with one another, recruit allies, and rise through the guild ranks.',
    'Every mission leads deeper into a world shaped by ancient secrets and opposing forces. The team’s choices will determine more than which Pokémon are rescued—they may decide what the woodland becomes.',
    'Form your rescue team. Brave the Mystery Dungeons. Discover what is calling from within the forest.',
  ],
  humanity: 'Humanity represents your connection to who you were before becoming a Pokémon. Giving in to primal instincts weakens that connection—and if your Humanity reaches zero, your human memories and sense of self may disappear forever.',
  instinct: 'Instinct represents how deeply you have adapted to your Pokémon body and its natural power. As it grows, stronger moves and abilities become available—but relying too heavily on instinct can pull you further from your human self.',
};

// Story & Guild Rank progression
export const CHAPTERS = [
  { n: 0, title: 'The Voice of the Forest', quote: 'Before the forest knew your name, another world called you home.', rank: 'Basic Rank', status: 'complete',
    recap: [
      'Vanguard Guild caught up in a storm on their way to Beautifly’s bequest. Woodland Base gets an Emergency Guild Summons and drags them to safety in Gravity Falls Guild. When they emerge it was like the storm never came at all.',
      'Read the Charter and received their Aura Bow, Guild Point Tracker and Explorer’s Pack.',
      'Visited the Travelling Merchant - Slash.',
    ],
    events: [
      'Unnatural storms intensified across the region, forcing nearly every experienced rescue team into the field.',
      'A terrible, unexplained shriek echoed across the entire known world. Pokémon everywhere stopped as the sound passed through the land, water, and sky. No one knows what cried out—or why its pain could be felt by everyone who heard it.',
      'With the Vanguard Guild missing and every other team deployed, Gemini, Felicia, and Rox became Woodland Base’s only available rescue team. The team rescued Rayson the Wingull and discovered all four Vanguard members mysteriously unconscious. They were alive and unharmed, but no one knows what caused four experienced rescuers to collapse together.',
      'They also won big at the Lucky Den Gambling Corner, much to Chandelure’s disgust.',
      'A Comfey was badmouthed. The guild acknowledges this happened but declines further comment.',
    ],
    opening: '“It’s finally made its way here... Our peaceful life is ending. The land is angry for something we had no part of...” The cry passed through the roots beneath Woodland Base. It raced along Crystal Lake, climbed the Mooncliff Mountains, disturbed the mist of Whispering Falls, and shook dust from the stones of the Ancient Ruins. It crossed Sunshell Beach with the storm tide and awakened the purple flames of Hollowlight. Every Pokémon across the known world heard something.',
  },
  { n: 1, title: 'Earthquake at Woodland Base', quote: 'The first warning was felt long before it was understood.', rank: 'Basic Rank', status: 'in progress',
    opening: 'A powerful earthquake strikes the Woodland Base, opening a burning fissure near the guild. Several Pokémon report seeing a massive shape moving beneath the ground shortly before the disaster. Because Groudon has appeared near previous earthquakes, the heroes are sent to investigate.',
    recap: [
      'Fissure destroys Gravity Falls Guild.',
      'Team Gemini, Felicia and Rox investigate the tearful cries of Grayson in Twilight Falls - where they heard a call for help but also the source of the fissures. Guildmaster Beautifly seems obsessed with the fissures...',
      'We need to rebuild...',
    ],
    events: [
      'Fissures have torn through the land surrounding Woodland Base. Roads have split, supplies have fallen, and parts of the community have been severely damaged.',
      'Storms, earthquakes, and disappearances continue throughout the region. Rumors increasingly blame Groudon, whose wrath is said to leave broken earth in its wake.',
      'Woodland Base survived—but it cannot return to normal without help.',
      'Final Chapter 1 Objective: Rebuild the community and restore Woodland Base. Clear the damage. Recover supplies. Repair essential services. Help displaced Pokémon return home.',
    ],
  },
  { n: 2, title: 'The Fading Blossom Meadow', quote: 'What breaks can be rebuilt—but never exactly as it was.', rank: 'Basic Rank', promo: 'Bronze at the end' },
  { n: 3, title: 'Poisoned Waters at Crystal Lake', quote: 'The forest’s silence begins where the flowers stop growing.', rank: 'Bronze Rank' },
  { n: 4, title: 'Chapter 4', quote: 'Something beneath the stone is answering.', rank: 'Bronze Rank', promo: 'Silver at the end' },
  { n: 5, title: 'Chapter 5', quote: 'Not every path can be found in daylight.', rank: 'Silver Rank' },
  { n: 6, title: 'Chapter 6', quote: 'The water remembers what the land has forgotten.', rank: 'Silver Rank', promo: 'Gold at the end' },
  { n: 7, title: 'Chapter 7', quote: 'The earth is restless—and something is stirring with it.', rank: 'Gold Rank' },
  { n: 8, title: 'Chapter 8', quote: 'Two witnesses have watched the truth from afar.', rank: 'Gold Rank', promo: 'Diamond at the end' },
  { n: 9, title: 'Chapter 9', quote: 'Where fire meets water, the hidden entrance waits.', rank: 'Diamond Rank' },
  { n: 10, title: 'Chapter 10', quote: 'The forest’s greatest treasure is also its heaviest burden.', rank: 'Diamond Rank', promo: 'Lucario after Victory' },
];

// Guild Ranks & Rewards (handout "Guild Ranking Progression")
export const RANKS = [
  { n: 1, name: 'Rankless', alt: 'Starter', gp: 0, req: ['Entered the World as a Pokémon.'], rewards: ['Can only hold a single Held Item', 'Maximum 999 Poké'], missions: '—', recruit: 0 },
  { n: 2, name: 'Basic Rank', alt: 'Beginner', gp: 0, req: ['Joined a Guild.'], rewards: ['Tattered bag: holds 5 items and up to 9,999 Poké', 'One meal every night', 'Shared room, sleep on the floor', 'Access to Storage and Unwanted Items boxes'], missions: 'E', recruit: 1 },
  { n: 3, name: 'Bronze Rank', alt: 'Amateur', gp: 50, req: ['Collected 50 Guild Points.'], rewards: ['2 Reviver Seeds', '3 Oran Berries', '2 Orbs'], missions: 'D', recruit: 2 },
  { n: 4, name: 'Silver Rank', alt: 'Ace', gp: 150, req: ['Collected 150 Guild Points', 'Completed 5 D Ranked Missions or 1 C Ranked Mission.'], rewards: ['Sturdy bags: 15 items and up to 50,000 Poké', '2 Reviver Seeds', 'One Weapon or Garment per team member', '1 favor from a local every 60 days', 'Two meals a day', 'Shared team room with hay beds'], missions: 'C', recruit: 4 },
  { n: 5, name: 'Gold Rank', alt: 'Pro', gp: 350, req: ['Collected 350 Guild Points', 'Completed 10 C Ranked Missions or 2 B Ranked Missions', 'Helped the Guild Leader with a personal request.'], rewards: ['1 Oran Berry per Pokémon and 1 Apple for every mission', '1 favor from a Guild Member every 30 days', '3 Reviver Seeds', 'One Weapon, Garment, or Evolution Item per team member'], missions: 'B', recruit: 6 },
  { n: 6, name: 'Diamond Rank', alt: 'Master', gp: 750, req: ['Collected 750 Guild Points', 'Deal with a minor regional threat OR complete 10 B Ranked or 4 A Ranked Missions.'], rewards: ['Poké pouch holds up to 99,999 Poké', 'A favor from the Guild Leader', 'Three meals a day', 'Private rooms with wool beds', 'Access to Valuable Items Box'], missions: 'A', recruit: 10 },
  { n: 7, name: 'Lucario Rank', alt: 'Champion', gp: null, req: ['Handle a Legendary-level threat.'], rewards: ['Access to S Ranked Missions', 'Can learn one move from a trusted Legendary'], missions: 'S', recruit: Infinity },
];

export const MISSION_GP = { E: 5, D: 10, C: 20, B: 30, A: 50, S: 100, X: 0 };

export const MISSION_TYPES = {
  E: ['Gather water and food for the Guild', 'Find lost items or Pokémon in Guild territory', 'Take care of the babies in the community', 'Help build shelters', 'Watch over supplies'],
  D: ['Rescue lost Pokémon in hostile territory', 'Track and defeat a troublemaker Pokémon', 'Find Berries and Seeds for the Guild', 'Watch for intruders on the borders', 'Teach the young how to survive'],
  C: ['Track and defeat a hostile Pokémon', 'Chase away rival Guild members or humans', 'Disable traps set by rivals', 'Find Garments and Weapons for the Guild', 'Teach the young how to fight', 'Escort a community member through hostile territory'],
  B: ['Track and defeat a hostile pack', 'Infiltrate a rival Guild or human town to get goods', 'Find rare orbs and stones', 'Recruit a strong member for the Guild', 'Top secret missions from the Guild Leader'],
  A: ['Track and defeat an enemy Guild', 'Claim new territory', 'Locate and destroy unnatural locations', 'Ally at least 3 marauding packs to the Guild', 'Assist with a Minor Legendary'],
  S: ['Run messages between the Guild and a Legendary', 'Assist with a Major Legendary', 'Establish a new Guild Base in a new region', 'Ally a Legendary to the Guild', 'Save the Guild from a disaster'],
  X: ['Assist with Arceus and/or Their Children', 'Save the world from a Legendary-level threat', 'Ally Arceus or Their Children to the Guild'],
};

export const FAILURE_RULES = [
  'You cannot forfeit a mission once taken.',
  'Failing a mission reduces Guild Points equal to that mission’s value.',
  'Failure can cause a Rank Down.',
  'If another team completes it first, you lose only half the Guild Points.',
  'Failing an X Rank Mission loses 200 Guild Points.',
  'If your team falls below -25 Guild Points, you are kicked out of the Guild.',
];

export const HUMANITY = [
  [5, 'Human memories clear'], [4, 'Details begin to fade'], [3, 'Two lives in conflict'],
  [2, 'Instinct overrides memory'], [1, 'The human self is almost gone'], [0, 'Fully Pokémon'],
];
export const INSTINCT = [
  [0, 'Prey', 'No moves. Others find it dangerous to be with you.'],
  [1, 'Cub', 'Starter moves. Nurturing or weak Pokémon will stay with you.'],
  [2, 'Beta', 'Learn up to Beginner rank without a rescue team. You can be part of a group, but stronger Pokémon will bother you.'],
  [3, 'Hunter', 'Learn up to Ace rank without a Silver Rank rescue team. You have proved your value and gained respect.'],
  [4, 'Alpha', 'Learn up to Pro rank without a Gold Rank rescue team. Lead your own guild, and others will ask to join.'],
  [5, 'Predator', 'Learn any move from your species—even later evolution stages. Top of the food chain; Pokémon will fight to eat your scraps.'],
];

// Rules pages. Each: id, title, img (handout), body paragraphs, optional list
export const RULES = [
  { id: 'new-character', title: 'New Character', art: 'assets/gs/new_character_sheet.jpg', body: [
      'Every rescue team begins somewhere. Before entering the world of PokéRole Mystery Dungeon, you’ll create the human you were, determine the Pokémon you’ve become, and prepare your character for play.',
      '1. Create your character concept with the Background Form (personality, history, motivations, goals, important memories). Focus on who your character is first.',
      '2. Build your character sheet. Your character must live primarily on land, be Starter rank and non-legendary. Record Attributes and Social Attributes, Skills, Nature, Pokémon information, Moves and Abilities, and other starting statistics. Use the Rulebook for stat distributions.',
      '3. Upload your character: the campaign spreadsheet (🪙 Gravity Falls - Guild tab) or Roll20 (Journal → + Character). Without Roll20 most dungeon macros will not work for you. You can also build and keep your sheet right here on the Play page.',
    ], list: [
      'Logic starts at Base 1. Logic can never be more than Humanity. Logic replaces Loyalty. Whenever you buy or gain a point of Logic your Instinct lowers by 1. Held items not in the original game require Logic to be used.',
      'Instinct starts at Base 1. Instinct replaces Happiness.',
      'Choose to add +1 to Logic or Instinct.',
      'Starting Humanity is 6 with Logic 2 / Instinct 1, or 4 with Logic 1 / Instinct 2. Talk to the GM if your character was never human.',
      'Some character sheets do not capture Logic, Instinct, Humanity and Primal Score — track them here.',
    ] },
  { id: 'humanity', title: 'Humanity & Primal State', img: 'humanity', body: [
      'Humanity is the memory of the person you once were. Entering a Primal State costs 1 Humanity.',
      'When distressed you can go into Primal State: regain all health, cure status conditions, restore reductions to attributes and ignore pain penalties, and add extra dice to all actions equal to your Instinct. You’ll be feral until you’re safe or the scene is safe.',
      'If you faint in Primal State you gain a Primal Point (negative Humanity point) and lose one Will permanently.',
      'At Humanity 0 you lose control of your character. You are fully a Pokémon and cannot remember ever being human.',
    ] },
  { id: 'instinct', title: 'Instinct', img: 'instinct', body: [
      'Instinct can be earned at the GM’s discretion through role-playing (every gained Instinct is Humanity −1): raw power, moves or survival. Gain it by defeating wild Pokémon that have a problem with you, or by training.',
    ] },
  { id: 'combat', title: 'Combat & Movement', img: 'combat', body: [
      'Combat is turn-based and built around teamwork. On your turn: 1) Movement, 2) take 1 action, 3) resolve effects. Normal movement is 2 + Dexterity squares, before or after your action. Difficult terrain costs 2 movement per square.',
      'Actions: Use a Move, Use an Item, Dash (spend an action for more movement), Maneuver, Hold.',
      'Engaged = adjacent to an enemy. Contact moves need adjacency; ranged moves need line of sight.',
      'Attack: roll Accuracy → foe may Evade or Clash → roll Damage. Reactions: Evade (Dexterity + Evasion) or Clash (Strength/Special + Clash), once each per round; both cost an action.',
      'Round: everyone acts in Initiative order (1d6 + Dexterity + Alert). Extra actions happen after everyone’s first action — the 2nd action needs 2 successes, the 3rd needs 3, and so on.',
    ] },
  { id: 'dice', title: 'Rolling Dice (PokéRole)', body: [
      'Dice pool = Attribute + Skill. Roll that many d6: every 4, 5 or 6 is a success.',
      'Damage: pool = Strength/Special + the move’s Power − foe’s Defense (Vitality) / Special Defense (Insight). Each success is 1 HP of damage. Critical hit (3+ successes more than needed on Accuracy) adds 2 dice. Super effective +1 damage (+2 if both types), not very effective −1 (−2), immune = 0.',
      'Pain: at half HP remove 1 success from your rolls; at 1 HP remove 2.',
      'House rule: every two 1s rolled removes a success.',
      'Chance dice: roll the number of dice listed; any 6 triggers the effect.',
      'Will points: earned like inspiration — spend to ignore a bad roll / reroll.',
      'HP = Vitality + Base HP (humans: Vitality + 4). Rest auto-heals 1 HP per 8 hours; Basic heal 3 HP, Complete heal 5 HP.',
    ] },
  { id: 'quick-rolls', title: 'E-Rank Quick Rolls', body: [
      'Choose the approach that best matches what your Pokémon actually does. Results: 0 = complication or new obstacle; 1 = partial success at a cost; 2 = standard E-Rank success; 3+ = excellent success, gain a clue or advantage.',
      'Teamwork: one Pokémon leads the roll. Each reasonable helper adds +1 die (maximum +2). Describe how each helper contributes.',
      'GM note: reward creative approaches. If a different Attribute or Skill clearly fits, allow it and set difficulty by risk: 1 easy, 2 standard, 3 challenging.',
    ] },
  { id: 'traps', title: 'Traps & Hazards', img: 'traps', body: [
      'Detect first: roll Insight + Alert. Hidden trap 3 successes, well-hidden 5+. You must detect a trap before attempting a response.',
      'Disarm: Smart + Logic (simple 3, complex 5+). Some traps need the correct tools. Failure activates the trap.',
      'Avoid: Smart + Logic + Nature (simple 3, complex 5+). Failure activates the trap; an avoided trap remains active.',
      'Resist a Lure: Pure Logic 1 success, or Pure Will 3 successes. Failure activates the trap.',
      'Detecting or avoiding a trap does not automatically protect every teammate. Not every danger is a trap: unstable terrain, falling debris, rushing water, fire and darkness change how your team moves and fights.',
    ] },
  { id: 'evolution', title: 'Evolution', img: 'evolving', body: [
      'Evolution can happen during an intense, life-saving moment or surge of energy. You may accept or refuse, but evolving is permanent: +1 Instinct, −1 Logic, −1 Humanity. It can unlock new possibilities but pushes your character further from the human they once were.',
    ] },
  { id: 'training', title: 'Training', img: 'training', body: [
      'Spend days off honing your skills: roll Instinct or Logic + Insight. Each success = 1 Training Point (TP).',
      '25 TP = +1 Logic, Instinct, Humanity or Will, or −1 Primal Point. Humanity may only be increased while your Primal Points are 0.',
      '5 TP = retrain: redistribute Attributes and Social Attributes gained from Rank, or forget moves and learn others currently available.',
      'Train allies: 5 TP retrains an NPC; ranking an ally up costs TP equal to the successes normally required. An ally can’t rank up beyond your own Rank.',
      'Training Points are the only way to change Logic, Instinct, Humanity, Will or Primal Points.',
    ] },
  { id: 'recruiting', title: 'Recruiting & Limits', img: 'recruiting_limits', body: [
      'After defeating an NPC Pokémon choose one approach, opposed by the NPC’s Will: Dominate (Tough + Instinct + Intimidate), Befriend (Cool or Beauty + Allure), Impress (Smart + Logic + Perform).',
      'Active rescue team: 2–5 Pokémon. Total roster: up to 24. Mission start: maximum 5 party members; recruits and escorts gained during a mission don’t count, hard cap 8.',
      'Recruiting Power by rank: Rankless 0, Basic 1, Bronze 2, Silver 4, Gold 6, Diamond 10, Lucario unlimited. Temporary allies don’t count. NPC teammates can’t be trained or ranked above your own allowed Rank.',
      'Loyalty matters: NPC teammates may leave if they faint and are abandoned. Stay with them or bring them to safety to increase Loyalty.',
    ] },
  { id: 'directing', title: 'Directing Teammates', img: 'directing', body: [
      'Your teammates can act independently, but you can spend an action to give an ally or NPC a clear instruction. Directed teammates follow your command as closely as they can. If you don’t direct them, the GM decides how they act based on their Instinct, personality and the situation.',
    ] },
  { id: 'dungeons', title: 'Mystery Dungeons', img: 'dungeon_building', body: [
      'A dungeon is hard to escape, has clear but treacherous paths with dead ends, and hides powerful Pokémon and valuable items. Types include forest, cave, ruins/temple, abandoned house, factory and legendary den.',
      'Every 2 new tiles explored, the GM rolls an event: 1 trap or hazard, 2 enemy team, 3 treasure, 4 guild challenge, 5 safe passage, 6 mission objective (a clue).',
      'If your team is beaten, your bags are emptied, your progress may be lost, and you may be left to retreat, be abandoned, or wait for rescue.',
      'Missions take place in territories belonging to another Pack/Guild; team rank restricts your territory access. Other teams can complete the same missions — only the first team gets the full reward, later teams get half.',
    ] },
  { id: 'rivals', title: 'Enemy Teams & Guild Challenges', body: [
      'Enemy teams from rival guilds try to take you down or foil your mission. The higher the threat, the bigger the bonus Guild Points — and the penalty if you refuse to deal with them: low 25%, medium 50%, high 75%. Max level turns the mission into stopping them (B rank, can’t be ignored).',
      'Guild Challenge: teams of the same guild battle for glory and points. Declining costs 50% of the Guild Points. Accepting: +5 if they are lower than you, +10 same rank, +15 one rank higher, +20 two or more higher, plus the rewards for winning. If you accept and lose, the Guild won’t penalize you more than the wager.',
      'Bullies: marauding packs of the same species commanded by the final form of their evolution family. Nomads may cause trouble or provide assistance.',
    ] },
  { id: 'items-rules', title: 'Items, Food & Garments', img: 'missions_items', body: [
      'Food is a currency along with Poké: 10 Poké = 1 Apple. Apples restore Hunger; Big Apples restore more.',
      'Seeds affect one Pokémon; Orbs affect a small area (room/floor). Both count as an action when used.',
      'Weapons (optional rule) require Logic to craft and use, use the Held Item slot and don’t gain STAB.',
      'A Pokémon can wear one of each kind of garment: 3 garment slots plus 1 Held Item slot.',
    ] },
];

export const HANDOUTS = [
  ['banner', 'Banner'], ['combat', 'Movement & Combat'], ['directing', 'Directing Teammates'], ['dungeon_building', 'Build a Dungeon'],
  ['guild_rank', 'Guild Ranks & Rewards'], ['missions_items', 'Missions, Items & Garments'], ['humanity', 'Humanity'], ['instinct', 'Instinct'],
  ['evolution', 'Evolution'], ['evolving', 'Evolving (older version)'], ['training', 'Training'], ['recruiting', 'Recruiting'], ['recruiting_limits', 'Recruiting & Guild Rank'],
  ['traps', 'Traps & Hazards'], ['dungeon_village_missions', 'Dungeon & Non-Dungeon Missions'],
  ['story_ranks', 'Story & Guild Rank Progression'], ['mission_ranks', 'Missions, Items & Garments (site)'], 
];

export const GUILDS = {
  intro: [
    'Non-dungeon missions are the backbone of the Gravity Falls Guild: gathering supplies, helping local Pokémon, investigating problems, escorting travelers, repairing damaged areas, delivering resources and building relationships. They can unlock new allies, chapter choices, guild perks, and information that may weaken powerful enemies before major confrontations.',
    'Mystery Dungeons play a major role in the work of the guilds—especially the Vanguard Guild, whose teams are often sent into the most hazardous areas. Woodland teams are welcome to enter dungeons, but with extreme caution.',
    'Every mission is assigned a rank based on danger, difficulty, distance and expected rewards. As your Guild Rank increases, your team gains access to tougher missions—and greater rewards.',
  ],
  rivals: [
    { name: 'Team Meanies', banner: 'assets/gs/team_meanies.jpg', members: [['Gengar', 'gengar'], ['Ekans', 'ekans'], ['Medicham', 'medicham']], text: [
      'Long ago, Team Meanies—Gengar, Medicham, and Ekans—called themselves a rescue team, but heroism was never their true goal. They stole missions, manipulated vulnerable Pokémon, and spread fear in pursuit of wealth, influence, and power.',
      'They became bitter rivals of Pikachu and Squirtle, and Gengar twisted the legend of the Ninetales curse to drive them from Pokémon Square. Their schemes were exposed and the group faded from prominence—but rumors claim they may be active once again.',
    ] },
    { name: 'Team Skull', banner: 'assets/gs/team_skull.jpg', members: [['Skuntank', 'skuntank'], ['Zubat', 'zubat'], ['Koffing', 'koffing']], text: [
      'Led by Skuntank alongside Koffing and Zubat, Team Skull was a notorious exploration team known for bullying weaker Pokémon, stealing treasures, and taking credit for the work of others.',
      'They were fierce rivals of Kippy and Mimi, yet years later risked themselves to help them reach the Hidden Land—even if Skuntank refused to admit he cared. They now spend their days helping where they can at Gravity Falls. Not many seem to know their past...',
    ] },
  ],
};

// Meet the Characters (Google Site). portrait = file in assets/portraits (original game portraits only)
export const CAST = [
  { name: 'Gemini', art: 'assets/gs/cast_gemini.png', species: 'Cleffa', portrait: 'cleffa', text: 'Gemini is looking for a new guild and new friends (after getting kicked out of their last one). The kind of friend who’s gonna get you in trouble—but it’ll be fun! Loves games of chance and being out at night beneath the stars.' },
  { name: 'Slakoth', art: 'assets/gs/cast_slakoth.jpg', species: 'Slakoth', portrait: 'slakoth', text: 'A quiet dungeon guide with no memories from before he was found injured outside a mystery dungeon one year ago. Business is slow, but he’s earned a reputation for calmly navigating dangerous places. Most customers find him snoozing on the sign outside the Miltankshake Shack well after closing. His relaxed, sometimes oblivious behavior conceals a painful sense of failure.' },
  { name: 'Magnemite', art: 'assets/gs/cast_magnemite.jpg', species: 'Magnemite', portrait: 'magnemite', nature: 'Jolly', text: 'Fantasy engineer and young inventor—goofy, creative and logical. Approaches every problem as something that can be solved with gears, tools, and a sufficiently strange idea. His inventions almost work. Goal: invent something genuinely cool.' },
  { name: 'Puff', art: 'assets/gs/cast_puff.jpg', species: 'Cottonee', nature: 'Quirky', text: 'An unusually old Cottonee who floats through life stirring up harmless trouble and making others laugh. After Puff’s father chose their twin to inherit the family shop, Puff left home to find a place—and a purpose—of their own.' },
  { name: 'Rox', art: 'assets/gs/cast_rox.jpg', species: 'Jangmo-o', nature: 'Modest', text: 'An energetic adventurer who believes every small problem is the beginning of an important mission. Humble, quiet and kind. Travels from community to community helping Pokémon in need and leaves simple stone markers behind. Goal: grow strong enough to protect others and build the welcoming dojo he once dreamed of.' },
  { name: 'Felicia', art: 'assets/gs/cast_felicia.jpg', species: 'Tinkatink', nature: 'Bold', text: 'Metalwork artisan—focused, determined, curious, and intensely motivated once something captures her interest. Has a sharp eye for unusual materials and the patience to turn scraps, relics and rare finds into something meaningful.' },
  { name: 'Rocky', art: 'assets/gs/cast_rocky.jpg', species: 'Sudowoodo', portrait: 'sudowoodo', nature: 'Mild', text: 'A calm, dependable wanderer who creates stone art and keeps getting drawn into adventures through small acts of kindness. He doesn’t remember his past, but balancing stones makes him feel strangely at home. Goal: help protect the peaceful community he’s come to consider home.' },
  { name: 'Kippy', art: 'assets/gs/cast_mimi_kippy.jpg', species: 'Mudkip', portrait: 'mudkip', text: 'A hardy Mudkip who rose from rookie explorer to one of the guild’s celebrated Diamond Rank teams (Team Pika Pals) alongside their loyal Pikachu partner, Mimi. Together they recovered stolen Time Gears, survived the future’s paralyzed world, reached Temporal Tower and helped prevent time from collapsing.' },
  { name: 'Mimi', species: 'Pikachu', portrait: 'pikachu', text: 'Kippy’s loyal Pikachu partner and keeper of the treasured Relic Fragment. From rookie explorer to a celebrated Diamond Rank team (Team Pika Pals), Mimi recovered stolen Time Gears, survived the future’s paralyzed world, reached Temporal Tower and helped prevent time from collapsing.' },
];

// Item reference from the Google Site item pages (rarity tiers) + item category blurbs
export const ITEM_PAGES = {
  Mundane: ['Small Craft Material', 'Plain Ribbon', 'Plain Seed', 'Dull Iron Thorn', 'Stick', 'Geo Pebble'],
  Common: ['Quick Seed', 'Totter Seed', 'Warp Seed', 'Stun Seed', 'Sleep Seed', 'Blast Seed', 'Big Apple', 'Apple', 'Leppa Berry', 'Persim Berry', 'Aspear Berry', 'Rawst Berry', 'Pecha Berry', 'Chesto Berry', 'Cheri Berry', 'Oran Berry',
    'Whiff Specs', 'No-Aim Scope', 'Diet Ribbon', 'Racket Band', 'Patsy Band', 'Trapbust Orb', 'Switcher Orb', 'Slow Orb', 'See-Trap Orb', 'Pounce Orb', 'Lob Orb', 'Identify Orb', 'Blowback Orb', 'Fill-In Orb', 'Iron Thorn', 'Gravelerock'],
  Uncommon: ['Wiki Berry', 'Wepear Berry', 'Sitrus Berry', 'Razz Berry', 'Pinap Berry', 'Nanab Berry', 'Mago Berry', 'Lum Berry', 'Iapapa Berry', 'Figy Berry', 'Bluk Berry', 'Aguav Berry',
    'Via Seed', 'Decoy Seed', 'Violent Seed', 'Vile Seed', 'Doom Seed', 'Joy Seed', 'Hunger Seed', 'Heal Seed', 'Encourage Seed',
    'Weighted Projectile Pouch', 'Silver Spike', 'Uncommon Held Item (GM rolls)', 'Uncommon Garment (GM rolls)', 'Useful Crafting Cache'],
};

// Item category art from the GM's Google Site (Items page)
export const ITEM_ART = [
  ['Edible', 'Seeds · Berries · Food', 'assets/gs/items_edible.jpg'],
  ['Orbs', 'Control · Movement · Exploration · Protection · Power · Emergency & Terrain', 'assets/gs/items_orbs.jpg'],
  ['Wearables', 'Bands · Scarves · Bows · Ribbons · Held Items', 'assets/gs/items_wearables.jpg'],
  ['Utility', 'Poké · Projectiles · Tools · Materials · Keys · Maps · Storage gear · Valuables · Treasures', 'assets/gs/items_utility.jpg'],
];
export const RARITY_ART = { Mundane: 'assets/gs/card_mundane.jpg', Common: 'assets/gs/card_common.jpg', Uncommon: 'assets/gs/card_uncommon.jpg' };

export const ITEM_KINDS = [
  ['Seeds', 'Single-use items that create powerful tactical effects, such as awakening abilities, altering conditions, escaping danger, or gaining an advantage in battle.'],
  ['Berries', 'Natural remedies used to restore health, cure status conditions, and help rescue teams recover during difficult missions.'],
  ['Food', 'Travel provisions that keep teams nourished and energized throughout long dungeon expeditions.'],
  ['Orbs', 'Single-use magical tools that affect an entire room, floor, or exploration situation: Control (Slumber, Totter, Petrify, Foe-Hold), Movement (Warp, Switcher, Rollcall, Blowback), Exploration (Scanner, Radar, Stair-Locating), Protection (All-Protect, All-Dodge), Power (All-Power-Up, Pierce), Emergency & Terrain (Escape, Fill-In, Cleanse, Weather).'],
  ['Wearables', 'Ribbons, scarves, bands, bows, belts and necklaces provide ongoing benefits while equipped: improve attributes, resist hazards, strengthen moves, support exploration, or protect the wearer.'],
  ['Utility', 'Projectiles, tools, materials, keys, maps, storage gear, valuables and rare dungeon treasures, used for combat, exploration, crafting, rescue work and trading.'],
];

export const GARMENTS = [
  ['Mouthpiece of Good Fortune', 'Common', '+1 Dodge or Accuracy'],
  ['Scarf/Ribbon of Protection', 'Uncommon', '+1 Defense or Special Defense'],
  ['Belt/Necklace of Power', 'Uncommon', '+1 Strength or Special'],
  ['Protect Ribbon', 'Rare', 'Use Protect once per session with no failure chance'],
  ['Lucky Hat', 'Rare', 'Re-roll one failed roll per session'],
  ['Magic Jewelry', 'Very Rare', 'Grants one predetermined move the wearer normally wouldn’t learn'],
];

// Role-play actions shown as roll buttons on every character (Attribute + Skill dice pool)
export const ACTIONS = [
  { name: 'Perception', attr: 'Insight', skill: 'Alert', text: 'Notice danger, spot clues, hear something coming.' },
  { name: 'Investigate', attr: 'Insight', skill: 'Nature', text: 'Study tracks, plants, ruins or a strange object.' },
  { name: 'Persuade', attr: 'Beauty', skill: 'Allure', text: 'Talk someone round in a friendly way.' },
  { name: 'Charm', attr: 'Cute', skill: 'Allure', text: 'Win someone over by being harmless and adorable.' },
  { name: 'Negotiate', attr: 'Clever', skill: 'Etiquette', text: 'Bargain, trade or hold a proper, respectful talk.' },
  { name: 'Inspire', attr: 'Cool', skill: 'Etiquette', text: 'Lead the team or steady a scared ally.' },
  { name: 'Intimidate', attr: 'Tough', skill: 'Intimidate', text: 'Scare, threaten or command cooperation.' },
  { name: 'Deceive', attr: 'Clever', skill: 'Perform', text: 'Lie, bluff or act a part.' },
  { name: 'Distract', attr: 'Cool', skill: 'Perform', text: 'Put on a show or draw attention away.' },
  { name: 'Sneak', attr: 'Dexterity', skill: 'Stealth', text: 'Move unseen, hide or set an ambush.' },
  { name: 'Escape', attr: 'Dexterity', skill: 'Evasion', text: 'Slip free, dodge a grab or get away.' },
  { name: 'Climb & Balance', attr: 'Dexterity', skill: 'Athletic', text: 'Climb, jump, swim, cross or catch.' },
  { name: 'Lift & Force', attr: 'Strength', skill: 'Athletic', text: 'Carry, push, break or build.' },
  { name: 'Grapple', attr: 'Strength', skill: 'Brawl', text: 'Grab, pin or wrestle.' },
  { name: 'Endure', attr: 'Vitality', skill: 'Alert', text: 'Keep watch, resist fatigue, hunger or weather.' },
  { name: 'Sense Aura', attr: 'Special', skill: 'Channel', text: 'Feel energy, sense a Mystery Dungeon or use your power outside battle.' },
  { name: 'Remember', attr: 'Logic', skill: 'Insight', text: 'Recall something from your human life (Logic + Insight).' },
  { name: 'Trust Instinct', attr: 'Instinct', skill: 'Alert', text: 'Act on gut feeling (Instinct + Alert).' },
];

// E-Rank quick roll guide
export const QUICK_TASKS = [
  ['Search or notice clues', 'Insight', 'Alert'], ['Navigate or identify plants', 'Insight', 'Nature'],
  ['Climb, cross, catch, or balance', 'Dexterity', 'Athletic'], ['Carry, lift, or build', 'Strength', 'Athletic'],
  ['Move unseen or set an ambush', 'Dexterity', 'Stealth'], ['Endure fatigue or keep watch', 'Vitality', 'Alert'],
  ['Coordinate a careful plan', 'Insight', 'Etiquette'], ['Control or block movement', 'Dexterity', 'Clash'],
];
export const QUICK_SOCIAL = [
  ['Friendly persuasion or reassurance', 'Beauty', 'Allure'], ['Harmless or comforting appeal', 'Cute', 'Allure'],
  ['Proper, respectful conversation', 'Clever', 'Etiquette'], ['Inspire confidence or leadership', 'Cool', 'Etiquette'],
  ['Entertain or create a distraction', 'Cool', 'Perform'], ['Command cooperation', 'Tough', 'Intimidate'],
  ['Deceive through acting', 'Clever', 'Perform'], ['Make a dramatic impression', 'Cool', 'Perform'],
];
export const SPECIAL_ROLLS = [
  ['Initiative (1d6 + Dexterity + Alert)', 'init'],
  ['Evade (Dexterity + Evasion)', ['Dexterity', 'Evasion']],
  ['Clash (Strength + Clash)', ['Strength', 'Clash']],
  ['Clash (Special + Clash)', ['Special', 'Clash']],
  ['Detect trap (Insight + Alert)', ['Insight', 'Alert']],
  ['Disarm trap (Clever + Logic)', ['Clever', 'Logic']],
  ['Avoid trap (Clever + Logic + Nature)', ['Clever', 'Logic', 'Nature']],
  ['Resist a lure (Logic)', ['Logic']],
  ['Resist a lure (Will)', ['Will']],
  ['Recruit: Dominate (Tough + Instinct + Intimidate)', ['Tough', 'Instinct', 'Intimidate']],
  ['Recruit: Befriend (Cool + Allure)', ['Cool', 'Allure']],
  ['Recruit: Befriend (Beauty + Allure)', ['Beauty', 'Allure']],
  ['Recruit: Impress (Clever + Logic + Perform)', ['Clever', 'Logic', 'Perform']],
  ['Training (Instinct + Insight)', ['Instinct', 'Insight']],
  ['Training (Logic + Insight)', ['Logic', 'Insight']],
  ['Use item on a Pokémon (Clever + Medicine)', ['Clever']],
  ['Search for cover (Insight + Alert)', ['Insight', 'Alert']],
  ['Run away (Dexterity + Athletic)', ['Dexterity', 'Athletic']],
];

export const STATUS_IX = { Burn: 'Burn 1', Frozen: 'Frozen Solid', Flinch: 'Flinched', Infatuated: 'In Love', Blocked: 'Engaged', Fainted: 'Fainting' };
export const STATUSES = ['Burn', 'Poison', 'Badly Poisoned', 'Paralysis', 'Frozen', 'Sleep', 'Confused', 'Flinch', 'Infatuated', 'Blocked', 'Disabled', 'Primal State', 'Fainted'];
export const TYPES = ['Normal', 'Fire', 'Water', 'Electric', 'Grass', 'Ice', 'Fighting', 'Poison', 'Ground', 'Flying', 'Psychic', 'Bug', 'Rock', 'Ghost', 'Dragon', 'Dark', 'Steel', 'Fairy'];
export const NATURES = ['Adamant', 'Bashful', 'Bold', 'Brave', 'Calm', 'Careful', 'Docile', 'Gentle', 'Hardy', 'Hasty', 'Impish', 'Jolly', 'Lax', 'Lonely', 'Mild', 'Modest', 'Naive', 'Naughty', 'Quiet', 'Quirky', 'Rash', 'Relaxed', 'Sassy', 'Serious', 'Timid'];
export const ATTRS = ['Strength', 'Dexterity', 'Vitality', 'Special', 'Insight'];
export const SKILLS = ['Brawl', 'Channel', 'Clash', 'Evasion', 'Alert', 'Athletic', 'Nature', 'Stealth', 'Allure', 'Etiquette', 'Intimidate', 'Perform'];
export const SOCIAL = ['Tough', 'Cool', 'Beauty', 'Cute', 'Clever'];
export const RANK_NAMES = ['Starter', 'Beginner', 'Amateur', 'Ace', 'Pro', 'Master', 'Champion'];

// Loot Rolling Guide
export const LOOT = {
  lengths: [
    { name: 'Tiny', floors: '3-5', roll: [1, 4, 1] },
    { name: 'Short', floors: '6-10', roll: [1, 6, 2] },
    { name: 'Standard', floors: '11-20', roll: [2, 6, 2] },
    { name: 'Long', floors: '21-40', roll: [3, 6, 3] },
  ],
  category(d12) { return d12 <= 3 ? 'Projectile' : d12 <= 7 ? 'Berry' : d12 <= 10 ? 'Seed' : 'Treasure'; },
  rarity(t) { return t <= 2 ? 'Mundane' : t <= 6 ? 'Common' : t <= 8 ? 'Uncommon' : t <= 10 ? 'Rare' : t === 11 ? 'Very Rare' : 'Motherlode'; },
  value: { Mundane: 'Plain Seed, Apple, tiny Poké, or low-grade bundle', Common: 'up to 100 Poké', Uncommon: 'up to 300 Poké', Rare: 'up to 1,000 Poké; may be guarded', 'Very Rare': 'up to 2,500 Poké; normally guarded', Motherlode: 'Two Rare items plus a TM or equivalent; protected' },
  guard: { Mundane: [0, 'Usually unguarded; a trap is optional'], Common: [0, 'Usually unguarded; a trap is optional'], Uncommon: [1, 'Guard or trap on 1 on 1d6'], Rare: [2, 'Guard or trap on 1-2 on 1d6'], 'Very Rare': [6, 'One strong guardian, rival team, or dangerous trap'], Motherlode: [6, 'Guarded encounter or dungeon objective'] },
  // [die, [[max, result], ...], quantity]
  projectile: {
    Mundane: [4, [[2, 'Stick'], [3, 'Geo Pebble'], [4, 'Dull Iron Thorn']], [1, 3, 0]],
    Common: [6, [[2, 'Stick'], [4, 'Geo Pebble'], [5, 'Gravelerock'], [6, 'Iron Thorn']], [1, 4, 1]],
    Uncommon: [6, [[2, 'Iron Thorn'], [4, 'Gravelerock'], [5, 'Silver Spike'], [6, 'Weighted projectile pouch']], [1, 4, 0]],
    Rare: [6, [[2, 'Silver Spike'], [3, 'Cacnea Spike'], [4, 'Corsola Twig'], [5, 'Rare Fossil'], [6, 'GM’s choice of Rare projectile']], [1, 3, 0]],
    'Very Rare': [6, [[3, 'Golden Spike'], [4, 'Rare Fossil bundle'], [6, 'Masterwork projectile of the dungeon’s theme']], [1, 3, 0]],
    Motherlode: [0, [[0, 'Two different Rare projectiles, or one unique named projectile with a story benefit']], null],
  },
  berry: {
    Mundane: [1, [[1, 'Apple (Mundane: no berry)']], null],
    Common: [12, [[2, 'Oran Berry'], [3, 'Cheri Berry'], [4, 'Chesto Berry'], [6, 'Pecha Berry'], [7, 'Rawst Berry'], [8, 'Aspear Berry'], [9, 'Persim Berry'], [11, 'Leppa Berry'], [12, 'Roll again; find 2 berries']], null],
    Uncommon: [12, [[2, 'Sitrus Berry'], [3, 'Lum Berry'], [4, 'Figy Berry'], [5, 'Wiki Berry'], [6, 'Mago Berry'], [7, 'Iapapa Berry'], [8, 'Razz Berry'], [9, 'Bluk Berry'], [10, 'Nanab Berry'], [11, 'Wepear Berry'], [12, 'Pinap Berry']], null],
    Rare: [20, [[1, 'Occa Berry'], [2, 'Passho Berry'], [3, 'Wacan Berry'], [4, 'Rindo Berry'], [5, 'Yache Berry'], [6, 'Chople Berry'], [7, 'Kebia Berry'], [8, 'Shuca Berry'], [9, 'Coba Berry'], [10, 'Payapa Berry'], [11, 'Tanga Berry'], [12, 'Charti Berry'], [13, 'Kasib Berry'], [14, 'Haban Berry'], [15, 'Colbur Berry'], [16, 'Babiri Berry'], [17, 'Chilan Berry'], [18, 'Roseli Berry'], [19, 'Pomeg / Kelpsy / Qualot Berry (1d3)'], [20, 'Hondew / Grepa / Tamato Berry (1d3)']], null],
    'Very Rare': [12, [[1, 'Liechi Berry'], [2, 'Ganlon Berry'], [3, 'Salac Berry'], [4, 'Petaya Berry'], [5, 'Apicot Berry'], [6, 'Lansat Berry'], [7, 'Starf Berry'], [8, 'Enigma Berry'], [9, 'Micle Berry'], [10, 'Custap Berry'], [11, 'Jaboca Berry'], [12, 'Rowap Berry']], null],
    Motherlode: [0, [[0, 'Preserved grove cache: roll twice on Rare berries and once on Very Rare. Guarded, or the objective of another expedition.']], null],
  },
  seed: {
    Mundane: [4, [[3, 'Plain Seed'], [4, 'Blast Seed']], null],
    Common: [8, [[2, 'Blast Seed'], [3, 'Sleep Seed'], [4, 'Stun Seed'], [5, 'Totter Seed'], [6, 'Warp Seed'], [7, 'Quick Seed'], [8, 'Plain Seed pair']], null],
    Uncommon: [8, [[2, 'Heal Seed'], [4, 'Encourage Seed'], [5, 'X-Eye Seed'], [6, 'Hunger Seed'], [7, 'Pure Seed'], [8, 'Violent Seed']], null],
    Rare: [8, [[2, 'Tiny Reviver Seed'], [3, 'Joy Seed'], [4, 'Vile Seed'], [5, 'Doom Seed'], [6, 'Dropeye Seed'], [7, 'Eyedrop Seed'], [8, 'Vanish Seed']], null],
    'Very Rare': [6, [[2, 'Reviver Seed'], [3, 'Golden Seed'], [4, 'Life Seed'], [5, 'Via Seed'], [6, 'Empowerment Seed']], null],
    Motherlode: [0, [[0, 'One Very Rare seed plus two different Uncommon seeds, sealed in a protected cache']], null],
  },
  treasure: {
    Mundane: [6, [[1, 'Plain Seed'], [2, 'Single Apple'], [3, '{1d6x5} Poké'], [4, 'One Common projectile'], [5, 'Small craft material'], [6, 'Roll again; cache is trapped']], null],
    Common: [6, [[1, '{1d6x10} Poké'], [2, '{1d4} Apples'], [3, 'Common Berry pair'], [4, 'Common Seed pair'], [5, 'Common projectile bundle'], [6, 'Common held item or craft material']], null],
    Uncommon: [6, [[1, '{100+1d4x25} Poké'], [2, 'Big Apple plus {1d3} Apples'], [3, 'Uncommon Berry or Seed'], [4, 'Uncommon projectile or Common Orb'], [5, 'Uncommon garment / held item'], [6, 'Useful crafting cache']], null],
    Rare: [6, [[1, '{300+1d6x100} Poké'], [2, 'One TM'], [3, 'Rare Berry or Seed'], [4, 'Rare projectile plus Common bundle'], [5, 'Rare garment / held item'], [6, 'Evolution item or Rare Orb']], null],
    'Very Rare': [6, [[1, '{1000+1d6x250} Poké'], [2, 'TM plus one Uncommon item'], [3, 'Very Rare Berry or Seed'], [4, 'Very Rare garment / held item'], [5, 'Evolution item plus 300 Poké'], [6, 'Guild relic, map fragment, or favor token']], null],
    Motherlode: [0, [[0, 'Two Rare items + a massive Poké or Apple pile + one TM. Place guardians nearby.']], null],
  },
};

export const DUNGEON_EVENTS = [
  null,
  ['Trap or Hazard', 'Roll the trap/hazard. Players detect with Insight + Alert first.'],
  ['Enemy Team', 'A rival team tries to take you down or foil your mission.'],
  ['Treasure', 'Roll 2 dice for direction and 1 die for distance (reroll 5s and 6s). Small supplies, useful items, Poké, or rare loot.'],
  ['Guild Challenge', 'Another team from the same guild challenges you for glory and points.'],
  ['Safe Passage', 'Nothing happens. Breathe.'],
  ['Mission Objective', 'A clue is revealed. Roll 2 dice for direction and 1 die for distance (reroll 5-6).'],
];
export const DUNGEON_TYPES = ['Forest', 'Cave', 'Ruins / Temple', 'Abandoned House', 'Factory', 'Legendary Den', 'Coast', 'Mountain', 'Lake'];

export const DISCLAIMER = 'A fan-made tabletop campaign. Pokémon and Pokémon Mystery Dungeon are © Nintendo, Creatures Inc., GAME FREAK inc., The Pokémon Company and Spike Chunsoft. This site is not affiliated with or endorsed by them. PokéRole is a fan game by its own creators.';

// From the GM's Discord (#world-events) and her campaign compendium. Player-facing facts only.
export const WORLD = {
  charter: ['Welcome to the Gravity Falls Guild! As a rescue team member, you will explore Mystery Dungeons, assist Pokémon in need, uncover mysteries, and contribute to the future of the forest.',
    'Our guild operates through rotating rescue assignments. You are not required to attend every session, and your teammates may change from mission to mission.',
    'Friday expeditions take place in person. Sunday expeditions take place online. Both contribute to the same story, and their results change our shared world.',
    'Every rescue matters. A team that recovers supplies may be just as important as one that defeats a powerful enemy.',
    'Your character grows through adventures, while the entire guild grows through shared accomplishments. No single rescue team can save the forest alone!'],
  guilds: [
    { name: 'Vanguard Guild', text: ['You are an experienced rescue guild hired by Guildmaster Beautifly to investigate the recent increase in mysterious Pokémon disappearances.',
      'Your team will lead dangerous, high-priority missions while coordinating with the less experienced Woodland Base. Both guilds share one world, and your actions will have lasting consequences.',
      'Expectations: a serious, story-driven group focused on roleplay, character development, investigation, and meaningful decisions. Humor is welcome, but engagement, teamwork, and consistent attendance are important (as much as you can!).',
      'The forest is hiding something, and Beautifly is counting on you to uncover the truth.'] },
    { name: 'Woodland Base', text: ['You are members of Guildmaster Beautifly’s rescue guild, a growing organization of aspiring rescuers dedicated to helping Pokémon in need.',
      'With mysterious disappearances increasing throughout the region, your guild has taken on greater responsibilities. While the experienced Vanguard Guild tackles dangerous frontline missions, your team will focus on rescues, exploration, investigations, and supporting the community.',
      'Expectations: a flexible, story-driven group focused on adventure, teamwork, character development, and having fun! Attendance is more casual, and rescue teams will change based on availability and mission needs.',
      'Every rescue matters! Your choices will shape the world and may directly affect the Vanguard’s missions. Even the smallest rescue team can make a big difference!'] },
  ],
  schedule: 'Friday sessions in person, Sunday sessions online in between, roughly 6:30–10 PM.',
  places: ['Woodland Base (the hub)', 'Sunshell Beach', 'Mooncliff Mountains', 'Echo Cavern', 'Crystal Lake', 'Blossom Meadow', 'Ancient Ruins', 'Whispering Falls', 'Twilight Falls'],
  camps: [
    { name: 'Mooncliff Mountains', text: 'Regirock is the strict expedition commander and caretaker: preparedness, punctuality and safety come first.' },
    { name: 'Tidal Rest Camps', text: 'Rampardos is the festive beach-gathering caretaker, Dhelmise an experienced water-rescue captain, and Galarian Slowking the sentinel.' },
    { name: 'Hollowlight Encampment', text: 'Bayou-like, lit by an unusual purple glow like Chandelure flames. Chandelure is the methodical surveyor and caretaker who insists on cave safety; Walrein is the sentinel.' },
    { name: 'Blossom Meadow, Glasswater Camps and Relicwatch', text: 'Other camps across the region. Every camp has a Psychic Link post.' },
  ],
  npcs: [
    // her update 10-29: what anyone who has been in the guild a while knows (his private GM profile stays off the public site)
    { name: 'Guildmaster Beautifly', text: 'Leader of the Great Guild (he/him), recently appointed after seven years serving on rescue teams. The young guild members call him “Mr. Fly.” Calm, compassionate and determined, and known for being graceful and quietly driven. He carries a personal connection to the forest collapse that divided the land: once a jolly but serious explorer, he grew more distant after his husband disappeared in it. As more Pokémon mysteriously disappear, Beautifly is determined to uncover where they are going and bring them home. His oldest teammate, Bramble the mischievous Scolipede, struggles to keep his joyful side alive, while Beatrice the proper Beedrill has taken on his husband’s former duties and tends to the guild when Beautifly cannot. Both are fiercely loyal to him.' },
    // her update 10-29 (public parts only: her private fear, struggle and role-play cues stay off the public site)
    { name: 'Beatrice the Beedrill', text: 'Champion rank (Lucario Rank), Mild nature, she/her. Team coordinator, guild caretaker and Beautifly’s second-in-command: proper, nurturing, perceptive, quietly formidable, and thoroughly English in spirit. Beautifly met her while sheltering from a storm at an overcrowded countryside rescue outpost, where she had everything under control: blankets, supplies, the injured, everyone’s manners and warm berry tea, all while directing the defense outside. She told him he was dripping rainwater on her clean floor, and he adored her immediately. She insisted she was only accompanying his team until they could care for themselves properly. She has been accompanying them ever since. Since the forest collapse she has quietly taken on the duties Beautifly’s husband once had (and sharply corrects anyone who says she replaced him). Bramble protects the guild’s body; Beatrice protects its heart. In battle she does not rush in, she controls it: Electroweb and Toxic Spikes to trap the field, Harden or Iron Defense, then precise volleys of Pin Missile. “You have threatened my children. I’m afraid you have exhausted my hospitality.”' },
    // her update 10-29 (public parts only: her private fear, struggle and role-play cues stay off the public site)
    { name: 'Bramble the Scolipede', text: 'Champion rank (Lucario Rank), Naughty nature, she/her. Beautifly’s oldest teammate, frontline defender and reluctant second-in-command: playfully defiant, fiercely loyal, physically affectionate, and terrifying when provoked. Long before Beautifly became Guildmaster, a wild Venipede kept sabotaging his team: vanished supplies, reversed trail markers, itching powder in his exploration bag. When he caught her, he laughed, offered her food and challenged her to guide them through a dungeon she knew better than they did. She never officially accepted. She simply kept showing up, and over years of rescues evolved into Whirlipede and then Scolipede. She earned Champion Rank by surviving battles others would never enter: Screech to break a foe’s confidence, Agility to close the distance, then Poison Tail, Double-Edge or Superpower. Her strategy is reckless but deliberate: make herself the biggest threat in the room so her teammates are ignored.' },
    { name: 'Diglett', text: 'Pro rank, Jolly nature. Curt but knowledgeable.' },
    { name: 'Machop', text: 'Beginner rank, Hardy nature. Missing, perhaps somewhere near Sunshell Beach.' },
    // her update 10-29 (public part only; his GM profile stays off the public site)
    { name: 'Rayson the Wingull', text: 'Age 8, he/him. Timid, gentle and loyal. Rayson is a quiet, childlike boy who frightens easily and hates being alone. He carries a great deal of regret about running away when someone needed him. Although fear often controls his choices, he desperately wants to become braver and prove that he can keep an important promise. Rescued from Twilight Falls.' },
    { name: 'Aegislash', text: 'Runs a travelling wagon shop with six item slots.' },
  ],
};

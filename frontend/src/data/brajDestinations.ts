export interface BrajDestination {
  id: string;
  name: string;
  slug: string;
  emoji: string;
  image: string;
  heroImage: string;
  templeIcon: string;
  shortDesc: string;
  fullDesc: string;
  famousTemples: string[];
  bestTimeToVisit: string;
  howToReach: string;
  nearbyPlaces: string[];
  highlights: string[];
  distance: string;
}

export const brajDestinations: BrajDestination[] = [
  {
    id: 'vrindavan',
    name: 'Vrindavan',
    slug: 'vrindavan',
    emoji: '',
    image: 'https://commons.wikimedia.org/wiki/Special:FilePath/Yamuna%20Aarti.jpg?width=900',
    heroImage: 'https://commons.wikimedia.org/wiki/Special:FilePath/Yamuna%20Aarti.jpg?width=1600',
    templeIcon: 'https://commons.wikimedia.org/wiki/Special:FilePath/Bankebihari%20temple%20main%20gate%20Vrindavan.JPG?width=200',
    shortDesc: 'A major Braj pilgrimage town associated with Krishna bhakti, temples, ghats and daily devotional life.',
    fullDesc: 'Vrindavan is one of the most visited sacred towns in Braj, closely associated with the childhood and youth pastimes of Krishna. Its strength is simple and lived-in: temple darshan, Yamuna ghats, kirtan, parikrama and devotional markets woven into everyday town life.',
    famousTemples: [
      'Banke Bihari Temple',
      'ISKCON Krishna Balaram Mandir',
      'Radha Raman Temple',
      'Prem Mandir',
      'Madan Mohan Temple',
      'Kesi Ghat',
    ],
    bestTimeToVisit: 'October to March is usually more comfortable. Festival periods such as Holi, Janmashtami and Kartik are special but crowded.',
    howToReach: 'Reach Mathura Junction by train, then travel by road to Vrindavan. Delhi and Agra are the nearest major air/road connections.',
    nearbyPlaces: ['Mathura', 'Gokul', 'Govardhan', 'Barsana', 'Nandgaon'],
    highlights: [
      'Morning or evening temple darshan',
      'Yamuna Aarti at Kesi Ghat',
      'Vrindavan parikrama',
      'Devotional shopping in local bazaars',
    ],
    distance: 'About 12-15 km from Mathura',
  },
  {
    id: 'mathura',
    name: 'Mathura',
    slug: 'mathura',
    emoji: '',
    image: 'https://commons.wikimedia.org/wiki/Special:FilePath/Madhura%20Yamuna%20Ghat.jpg?width=900',
    heroImage: 'https://commons.wikimedia.org/wiki/Special:FilePath/Madhura%20Yamuna%20Ghat.jpg?width=1600',
    templeIcon: 'https://commons.wikimedia.org/wiki/Special:FilePath/God%20Keshav%20Dev%20at%20Keshav%20Dev%20Temple.JPG?width=200',
    shortDesc: 'The central city of Braj and a major Krishna pilgrimage destination on the Yamuna.',
    fullDesc: 'Mathura is traditionally revered as the birthplace of Lord Krishna and is the main gateway for the Braj region. The city combines old ghats, temples, markets and pilgrimage routes, making it a practical starting point for visiting Vrindavan, Govardhan, Gokul, Barsana and Nandgaon.',
    famousTemples: [
      'Shri Krishna Janmabhoomi complex',
      'Dwarkadhish Temple',
      'Vishram Ghat',
      'Gita Mandir',
      'Bhuteshwar Mahadev Temple',
    ],
    bestTimeToVisit: 'October to March is pleasant. Janmashtami and Holi bring the strongest devotional atmosphere and larger crowds.',
    howToReach: 'Mathura Junction is a major rail stop. The city is connected by road with Delhi, Agra, Vrindavan and other Braj towns.',
    nearbyPlaces: ['Vrindavan', 'Gokul', 'Govardhan', 'Barsana', 'Nandgaon'],
    highlights: [
      'Darshan at Krishna Janmabhoomi',
      'Evening time near Vishram Ghat',
      'Local sweets and Braj markets',
      'Starting point for nearby Braj visits',
    ],
    distance: 'Braj region center',
  },
  {
    id: 'govardhan',
    name: 'Govardhan',
    slug: 'govardhan',
    emoji: '',
    image: 'https://commons.wikimedia.org/wiki/Special:FilePath/Grandeur%20of%20kusum%20sarovar.jpg?width=900',
    heroImage: 'https://commons.wikimedia.org/wiki/Special:FilePath/Grandeur%20of%20kusum%20sarovar.jpg?width=1600',
    templeIcon: 'https://commons.wikimedia.org/wiki/Special:FilePath/Girraj%20Ji%20Temple%20%2CMansi%20Ganga%20-%20panoramio.jpg?width=200',
    shortDesc: 'A sacred Braj town centered around Govardhan Hill and the parikrama path.',
    fullDesc: 'Govardhan is known for Giriraj ji, the hill worshipped by Krishna devotees. The main experience here is parikrama: a patient walk through temples, kunds and quiet stretches where devotion feels less like sightseeing and more like practice.',
    famousTemples: [
      'Daan Ghati Mandir',
      'Mansi Ganga',
      'Mukharavind Mandir',
      'Radha Kund',
      'Shyam Kund',
      'Kusum Sarovar',
    ],
    bestTimeToVisit: 'Cooler months are best, especially for parikrama. Kartik and Govardhan Puja are important but busy.',
    howToReach: 'Govardhan is reached by road from Mathura and Vrindavan. Mathura Junction is the nearest major railway station.',
    nearbyPlaces: ['Mathura', 'Vrindavan', 'Radha Kund', 'Kusum Sarovar'],
    highlights: [
      'Govardhan parikrama',
      'Darshan at Daan Ghati',
      'Visit Radha Kund and Shyam Kund',
      'Quiet time at Kusum Sarovar',
    ],
    distance: 'About 22-25 km from Mathura',
  },
  {
    id: 'nandgaon',
    name: 'Nandgaon',
    slug: 'nandgaon',
    emoji: '',
    image: 'https://commons.wikimedia.org/wiki/Special:FilePath/The%20Samaj%20Rituals-%20Holi%20at%20Nandgaon%20%2C%20Mathura.jpg?width=900',
    heroImage: 'https://commons.wikimedia.org/wiki/Special:FilePath/The%20Samaj%20Rituals-%20Holi%20at%20Nandgaon%20%2C%20Mathura.jpg?width=1600',
    templeIcon: 'https://commons.wikimedia.org/wiki/Special:FilePath/Interior%20of%20Nand%20Bhawan.jpg?width=200',
    shortDesc: 'A hilltop Braj village associated with Nanda Baba, Yashoda Maiya and Krishna childhood memories.',
    fullDesc: 'Nandgaon is traditionally associated with Nanda Baba and Yashoda Maiya, and is visited for its hilltop temple atmosphere and rural Braj character. It is quieter than Mathura or Vrindavan outside festival days, which is part of its charm.',
    famousTemples: [
      'Nand Bhawan',
      'Nand Rai Temple',
      'Pavan Sarovar',
      'Charan Pahari',
      'Ter Kadamba',
    ],
    bestTimeToVisit: 'October to March is comfortable. Holi season is culturally important and very crowded.',
    howToReach: 'Nandgaon is reached by road from Mathura, Barsana or Govardhan. Local taxis are the most practical option.',
    nearbyPlaces: ['Barsana', 'Govardhan', 'Mathura', 'Vrindavan'],
    highlights: [
      'Darshan at Nand Bhawan',
      'View of the Braj countryside',
      'Pavan Sarovar',
      'A quieter village-side Braj experience',
    ],
    distance: 'About 45-50 km from Mathura',
  },
  {
    id: 'barsana',
    name: 'Barsana',
    slug: 'barsana',
    emoji: '',
    image: 'https://commons.wikimedia.org/wiki/Special:FilePath/Radharani%20Temple%20Barsana.jpg?width=900',
    heroImage: 'https://commons.wikimedia.org/wiki/Special:FilePath/Radharani%20Temple%20Barsana.jpg?width=1600',
    templeIcon: 'https://commons.wikimedia.org/wiki/Special:FilePath/Radharani%20Temple%20Barsana.jpg?width=200',
    shortDesc: 'A Braj town known for Shri Radha Rani Mandir and its deep Radha-Krishna devotional identity.',
    fullDesc: "Barsana is one of Braj's most beloved towns, known especially for Shri Radha Rani Mandir on the hill. The town is devotional, colorful and best experienced slowly: temple darshan, hill views, narrow lanes and the rhythm of local Braj life.",
    famousTemples: [
      'Shri Radha Rani Mandir',
      'Maan Mandir',
      'Mor Kutir',
      'Daan Bihari Temple',
      'Pili Pokhar',
    ],
    bestTimeToVisit: 'October to March is usually best. Radha Ashtami and Holi are major festival times with heavy crowds.',
    howToReach: 'Barsana is connected by road from Mathura, Vrindavan, Govardhan and Nandgaon. Mathura Junction is the nearest major rail hub.',
    nearbyPlaces: ['Nandgaon', 'Govardhan', 'Mathura', 'Vrindavan'],
    highlights: [
      'Darshan at Shri Radha Rani Mandir',
      'Hilltop views of Barsana',
      'Visit Maan Mandir and Pili Pokhar',
      'Experience Braj Holi if visiting in season',
    ],
    distance: 'About 42-50 km from Mathura',
  },
  {
    id: 'gokul',
    name: 'Gokul',
    slug: 'gokul',
    emoji: '',
    image: 'https://commons.wikimedia.org/wiki/Special:FilePath/Radha%20Krishna%20GOKUL.jpg?width=900',
    heroImage: 'https://commons.wikimedia.org/wiki/Special:FilePath/Radha%20Krishna%20GOKUL.jpg?width=1600',
    templeIcon: 'https://commons.wikimedia.org/wiki/Special:FilePath/Radha%20Krishna%20GOKUL.jpg?width=200',
    shortDesc: "A quiet Braj village traditionally linked with Krishna's early childhood pastimes.",
    fullDesc: 'Gokul is traditionally remembered as the place where Krishna was brought after birth and spent His early childhood. The feeling here is softer and quieter than the bigger pilgrimage towns, with Raman Reti and Yamuna-side places giving the visit a reflective pace.',
    famousTemples: [
      'Raman Reti',
      'Brahmand Ghat',
      'Gokul Nath Temple',
      'Chaurasi Khamba',
      'Yashoda Bhawan',
    ],
    bestTimeToVisit: 'October to March is comfortable. Janmashtami and Nandotsav are meaningful but busier.',
    howToReach: 'Gokul is a short road journey from Mathura. Local taxis and autos are commonly used for nearby Braj visits.',
    nearbyPlaces: ['Mathura', 'Mahavan', 'Vrindavan', 'Govardhan'],
    highlights: [
      'Walk at Raman Reti',
      'Visit Brahmand Ghat',
      'Darshan at Gokul Nath Temple',
      'Slow village-side Braj visit',
    ],
    distance: 'About 10-15 km from Mathura',
  },
];

/* Seed data (stands in for books.txt, users.txt ...) and the local "store files" used by chat RAG. */
(function (root) {
  'use strict';
  const NS = (root.Inkwell = root.Inkwell || {});
  const R = () => NS.Rules;

  // Public-domain titles from Project Gutenberg. Prices are fictional (cents).
  const BOOKS = [
    [1, 'Pride and Prejudice', 'Jane Austen', 'Literature', 1813, 1200, '#6b2f3a', 42, 'romantic witty family classic thoughtful society', 'Elizabeth Bennet and Mr Darcy trade barbed remarks, misjudge each other and slowly learn better.'],
    [2, 'Frankenstein', 'Mary Shelley', 'Science fiction', 1818, 1100, '#2f4a43', 30, 'dark suspenseful thoughtful science gothic', 'A young scientist builds a living creature, then runs from what he has made.'],
    [3, 'The Time Machine', 'H. G. Wells', 'Science fiction', 1895, 850, '#2c3e5c', 25, 'short adventurous train future science quick', 'A Victorian inventor travels to the year 802,701 and finds a strange, divided future.'],
    [4, 'Alice\'s Adventures in Wonderland', 'Lewis Carroll', 'Fantasy', 1865, 900, '#5b4a8a', 20, 'short funny playful light fantasy comforting quick', 'Alice follows a white rabbit down a hole into a nonsense world of croquet and riddles.'],
    [5, 'The Secret Garden', 'Frances Hodgson Burnett', 'Literature', 1911, 1000, '#3d6b3f', 18, 'comforting hopeful peaceful nature gentle friendship', 'A lonely girl finds a locked garden and, with it, friends and a reason to heal.'],
    [6, 'The Adventures of Sherlock Holmes', 'Arthur Conan Doyle', 'Mystery', 1892, 1300, '#7a5a2a', 28, 'mystery clever short stories suspenseful detective', 'Twelve short cases in which Holmes reasons his way through puzzles that baffle Scotland Yard.'],
    [7, 'Dracula', 'Bram Stoker', 'Horror', 1897, 1250, '#6b1f1f', 35, 'dark suspenseful gothic scary night', 'Told in letters and diaries, a band of friends hunts the count who has come to England.'],
    [8, 'Treasure Island', 'Robert Louis Stevenson', 'Adventure', 1883, 950, '#1f5d6b', 15, 'adventurous exciting pirates sea quick', 'Young Jim Hawkins sails after buried pirate gold, with Long John Silver aboard.'],
    [9, 'Moby-Dick', 'Herman Melville', 'Adventure', 1851, 1500, '#243b4a', 12, 'adventurous thoughtful sea epic long', 'Captain Ahab chases the white whale across the oceans, whatever the cost to his crew.'],
    [10, 'The Picture of Dorian Gray', 'Oscar Wilde', 'Literature', 1890, 1050, '#4a2f4f', 22, 'dark witty thoughtful gothic', 'A beautiful young man stays unchanged while his portrait records every sin.'],
    [11, 'Meditations', 'Marcus Aurelius', 'Philosophy', 180, 800, '#5b5346', 10, 'thoughtful calm short reflective peaceful', 'Private notes from a Roman emperor on duty, patience and what lies in our control.'],
    [12, 'Walden', 'Henry David Thoreau', 'Philosophy', 1854, 1100, '#4d6a3a', 9, 'peaceful nature thoughtful calm reflective', 'Two years in a cabin by a pond, and a case for living deliberately.'],
    [13, 'Leaves of Grass', 'Walt Whitman', 'Poetry', 1855, 1100, '#7a6a2a', 8, 'hopeful lyrical thoughtful nature', 'A sweeping celebration of the self, the body and the young American democracy.'],
    [14, 'The War of the Worlds', 'H. G. Wells', 'Science fiction', 1898, 900, '#7a3a22', 21, 'suspenseful dark adventurous science quick', 'Martian tripods land in Surrey and the people of England run for their lives.'],
    [15, 'Twenty Thousand Leagues Under the Seas', 'Jules Verne', 'Adventure', 1870, 1200, '#1d4f73', 14, 'adventurous science sea exciting', 'Captain Nemo takes a captured professor on a tour of the deep in the submarine Nautilus.'],
    [16, 'The Hound of the Baskervilles', 'Arthur Conan Doyle', 'Mystery', 1902, 1150, '#3a3a4a', 19, 'mystery suspenseful dark detective moor', 'Holmes and Watson investigate a spectral dog said to haunt a family on the Devon moor.'],
    [17, 'Jane Eyre', 'Charlotte Brontë', 'Literature', 1847, 1350, '#5a3a2f', 24, 'romantic dark thoughtful gothic classic', 'An orphan becomes a governess and finds a secret at Thornfield Hall.'],
    [18, 'The Wonderful Wizard of Oz', 'L. Frank Baum', 'Fantasy', 1900, 800, '#2f6b52', 16, 'short light comforting hopeful fantasy quick', 'A Kansas girl and three odd companions walk the yellow brick road to find the Wizard.'],
    [19, 'Strange Case of Dr Jekyll and Mr Hyde', 'Robert Louis Stevenson', 'Horror', 1886, 750, '#3a3a3a', 11, 'short dark suspenseful scary quick night', 'A respectable doctor and a violent stranger share more than a London address.'],
    [20, 'Little Women', 'Louisa May Alcott', 'Literature', 1868, 1200, '#8a4a5a', 17, 'comforting hopeful family gentle warm', 'Four sisters grow up in Massachusetts during the Civil War, each chasing her own dream.'],
  ].map(([id, title, author, category, year, price, color, baseViews, tags, description]) =>
    ({ id, title, author, category, year, price, color, baseViews, tags, description, image: null }));

  const DAY = 86400000;
  const daysAgo = n => new Date(Date.now() - n * DAY).toISOString();

  /** Fresh demo data. Alex has no history (shows the popular list), Sam is nearly broke (fine demo). */
  function seed() {
    const reviewer = (id, name, type, bookId, stars, text, weight = 1, purchaser = false) =>
      ({ id, bookId, authorKey: `seed-${id}`, authorName: name, authorType: type, stars, text, weight, purchaser, date: daysAgo(10 - (id % 8)) });
    return {
      version: 2, session: null,
      users: [
        { id: 'u1', name: 'Alex Rivera', type: 'RC', balance: 3000, warnings: 0, status: 'active', sample: null },
        { id: 'u2', name: 'Priya Shah', type: 'VC', balance: 6000, warnings: 0, status: 'active', sample: null },
        { id: 'u3', name: 'Sam Lee', type: 'RC', balance: 50, warnings: 0, status: 'active', sample: null },
        { id: 'u4', name: 'Morgan Ellis', type: 'SU', balance: 0, warnings: 0, status: 'active', sample: null },
      ],
      books: BOOKS.map(b => ({ ...b })),
      purchases: [[1, 1], [6, 2], [9, 3], [15, 4], [17, 5]].map(([bookId, id]) => ({
        id, userId: 'u2', bookId, paid: BOOKS.find(b => b.id === bookId).price, date: daysAgo(40 - id * 5),
      })),
      views: [{ userId: 'u2', bookId: 1, date: daysAgo(30) }, { userId: 'u2', bookId: 16, date: daysAgo(3) }],
      reviews: [
        reviewer(1, 'Dana', 'RC', 7, 5, 'Atmospheric from the first letter.'),
        reviewer(2, 'Visitor', 'VS', 7, 5, 'Still creepy.'),
        reviewer(3, 'Jo', 'RC', 7, 4, 'Slow middle, great ending.'),
        reviewer(4, 'Priya Shah', 'VC', 7, 5, 'My favourite of the gothic set.', 3, true),
        reviewer(5, 'Lee', 'RC', 19, 2, 'Too short to land.'),
        reviewer(6, 'Visitor', 'VS', 19, 1, 'Did not enjoy.'),
        reviewer(7, 'Kim', 'RC', 19, 1, 'Flat.'),
        reviewer(8, 'Rowan', 'RC', 19, 2, 'Expected more.'),
        reviewer(9, 'Priya Shah', 'VC', 1, 5, 'Sharp and funny.', 3, true),
      ],
      fines: [], reopenings: [],
      taboo: ['spam', 'scam', 'idiot', 'trash', 'stupid'],
    };
  }

  const STATIC_DOCS = [
    { id: 'hours', level: 1, keywords: ['hours', 'open', 'opening', 'closing', 'close', 'schedule', 'weekend'],
      text: 'Inkwell is open Monday to Saturday 10 AM to 7 PM and Sunday 11 AM to 5 PM. These sample hours are fictional.' },
    { id: 'about', level: 1, keywords: ['inkwell', 'store', 'bookstore', 'about', 'team', 'dramp', 'project'],
      text: 'Inkwell is a smart bookstore built by team DRAMP for a software engineering course. The catalog comes from Project Gutenberg, so every title is in the public domain.' },
    { id: 'signin', level: 1, keywords: ['register', 'login', 'signin', 'face', 'camera', 'password', 'join'],
      text: 'There are no passwords. Register with a name and a face sample, then sign in by looking at the camera. A first deposit creates your account.' },
    { id: 'money', level: 1, keywords: ['deposit', 'balance', 'fine', 'fines', 'suspended', 'suspension', 'pay', 'payment'],
      text: 'Customers keep a balance and buy books from it. If a book costs more than your balance the sale is refused and a $1.00 fine is charged. A balance below zero suspends the account until an administrator reopens it.' },
    { id: 'reviews', level: 1, keywords: ['rating', 'ratings', 'review', 'reviews', 'comment', 'comments', 'taboo', 'warning', 'warnings', 'moderation', 'rules'],
      text: 'Anyone can rate a book 1 to 5 stars and comment. Up to three banned words are replaced with *. More than three blocks the comment and earns the author a warning. Reviews from people who bought the book count double.' },
    { id: 'vip', level: 3, keywords: ['vip', 'discount', 'perks', 'member', 'membership', 'promotion', 'promoted', 'upgrade', 'benefits'],
      text: 'VIP customers get 10% off every purchase and their ratings carry extra weight. A registered customer becomes VIP after more than 3 purchases or more than $200 spent. After more than 2 warnings a VIP is demoted instead of suspended.' },
  ];

  /** Documents this user may search. Order matters: earlier docs win ties. */
  function chatDocs(state, user) {
    const rules = R();
    const docs = [];
    if (rules.isCustomer(user)) {
      const st = rules.statsOf(state, user.id);
      docs.push({
        id: 'me', level: 2,
        keywords: ['balance', 'purchases', 'purchase', 'bought', 'history', 'spent', 'account', 'status', 'warnings'],
        text: `${user.name}: balance ${rules.money(user.balance)}, status ${user.status}, ${st.count} purchases totalling ${rules.money(st.spent)}, ${user.warnings} warnings.`,
      });
    }
    docs.push(...STATIC_DOCS);
    const f = rules.financeReport(state);
    docs.push({
      id: 'finance', level: 4,
      keywords: ['finance', 'financial', 'revenue', 'sales', 'profit', 'report', 'earnings', 'money'],
      text: `Finance report: sales ${rules.money(f.sales)} from ${f.count} purchases, fines ${rules.money(f.fines)}, total revenue ${rules.money(f.revenue)}, customer balances held ${rules.money(f.balances)}.` +
        (f.top ? ` Best seller: ${f.top.title} (${f.top.count}).` : ''),
    });
    for (const b of state.books) {
      const r = rules.ratingOf(state, b.id);
      docs.push({
        id: `book-${b.id}`, level: 1,
        keywords: [...new Set([...rules.words(`${b.title} ${b.author} ${b.category}`)].filter(w => w.length > 2))],
        text: `${b.title} by ${b.author} (${b.year}, ${b.category}), ${rules.money(b.price)}. ${b.description}` +
          (r.count ? ` Rated ${r.average.toFixed(1)}/5 by ${r.count} readers.` : ' Not rated yet.'),
      });
    }
    return docs;
  }

  NS.Data = { seed, chatDocs };
})(typeof self !== 'undefined' ? self : this);

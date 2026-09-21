// Review-only switches for design variations (nothing here changes the default experience).
//   ?intro=a|b|c   how the game explains itself   (a: profile line · b: hint on the map · c: page title)
//   ?en=a|b|c      how Election Night is reached   (a: not before the day · b: quiet preview link · c: from the countdown)
//   ?mobile=1|2|3  phone layouts                   (1: map + bottom sheet · 2: one question at a time · 3: map first)
//   ?empty=1       first visit: nothing picked yet
const Q = new URLSearchParams(location.search);
export const V = {
  intro: Q.get('intro') as 'a' | 'b' | 'c' | null,
  en: Q.get('en') as 'a' | 'b' | 'c' | null,
  mobile: Q.get('mobile') as '1' | '2' | '3' | null,
  empty: Q.has('empty'),
  more: Q.has('more'),
  title: +(Q.get('title') || 0), // 1..10 — title studies (see components/TitleStudies.tsx) // placeholder blocks where future content under the map will go
};
export const PURPOSE = 'Call every race. See how you did on Nov 3.';

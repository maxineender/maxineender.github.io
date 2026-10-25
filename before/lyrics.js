// Lyrics of "Before" with timings in seconds.
// `level` drives how vivid the paint is during that section (0 = muted, 1 = full colour).
window.BEFORE_LYRICS = [
  { tag: 'Intro', level: 0.5, lines: [] },
  { tag: 'Verse 1', level: 0.55, lines: [
    'I was almost leaving', 'When you found me', 'Found me at the door',
    'I had stopped believing', 'Believing'] },
  { tag: 'Chorus', level: 0.88, lines: [
    'Look what I became', 'After all the years', 'I was scared to change', 'Now I\'m standing here',
    'I gave you my doubt', 'You gave me a reason', 'I will never be', 'Who I was before'] },
  { tag: 'Break', level: 0.7, lines: [] },
  { tag: 'Verse 2', level: 0.62, lines: [
    'There were days I counted', 'Every failure', 'Every chance I missed',
    'Then you held my hand', 'Like you knew me', 'Knew me'] },
  { tag: 'Chorus', level: 0.92, lines: [
    'Look what I became', 'After all the years', 'I was scared to change', 'Now I\'m standing here',
    'I gave you my doubt', 'You gave me a reason', 'I will never be', 'Who I was before'] },
  { tag: 'Break', level: 0.74, lines: [] },
  { tag: 'Bridge', level: 0.66, lines: [
    'And if tomorrow', 'Takes you somewhere', 'I don\'t know', 'I won\'t forget',
    'What you showed me', 'What you gave me', 'I was lost', 'I was lost', 'Then I found myself'] },
  { tag: 'Final Chorus', level: 1.0, lines: [
    'Look what I became', 'After all the years', 'Even if you leave', 'I will still be here',
    'I gave you my doubt', 'You gave me a reason', 'I will never be', 'Who I was before'] },
  { tag: 'Outro', level: 0.8, lines: ['Who I was before', 'Who I was before'] },
];

// Section start times, per-line [start, end] pairs (same order as above) and sung repeats
// that are not in the written lyrics. Aligned with whisper on the master, fixed by hand.
window.BEFORE_TIMING = {"sections": [0, 34.29, 62.51, 90.46, 110.83, 138.03, 158.96, 185.29, 214.71, 236.73], "lines": [[], [[35.09, 38.83], [38.83, 44.69], [44.69, 49.9], [50.45, 55.98], [56.81, 60.06]], [[63.31, 65.43], [65.43, 67.39], [67.39, 69.55], [69.55, 70.97], [70.97, 73.39], [73.39, 74.99], [74.99, 77.5], [77.5, 81.4]], [], [[111.63, 115.39], [115.39, 121.2], [121.5, 125.6], [127.6, 131.6], [132.29, 135.03], [135.03, 138.83]], [[138.83, 141.83], [141.83, 143.69], [143.69, 145.63], [145.63, 147.25], [147.25, 149.33], [149.33, 151.27], [151.27, 153.11], [153.11, 158.46]], [], [[186.09, 189.01], [189.01, 191.89], [191.89, 197.19], [197.19, 200.29], [200.29, 203.77], [203.77, 207.61], [207.61, 210.63], [210.63, 212.49], [212.49, 215.51]], [[215.51, 217.87], [217.87, 219.81], [219.81, 221.67], [221.67, 223.45], [223.45, 225.49], [225.49, 227.41], [227.41, 229.87], [229.87, 234.56]], [[237.53, 242.3], [245.17, 249.8]]], "echoes": [[85.0, 89.0, "Who I was before"], [161.5, 165.4, "Who I was before"]]};

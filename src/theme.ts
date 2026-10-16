export const colors = {
  bg: '#0A0C11',
  bgTop: '#141A26',
  surface: '#121620',
  surfaceHi: '#181D29',
  line: 'rgba(255,255,255,0.07)',
  lineStrong: 'rgba(255,255,255,0.12)',
  text: '#F2EEE6',
  textDim: '#B9B4AA',
  muted: '#7A7F8C',
  brass: '#D9AE62',
  brassHi: '#F2D9A0',
  brassLo: '#A9772F',
  brassSoft: 'rgba(217,174,98,0.12)',
  good: '#7CCB9A',
  goodSoft: 'rgba(124,203,154,0.12)',
  warn: '#E6B05C',
  warnSoft: 'rgba(230,176,92,0.12)',
  bad: '#E07A7A',
  badSoft: 'rgba(224,122,122,0.12)',
  onBrass: '#1A1406',
};

export const stageColors: Record<string, string> = {
  Found: '#8A93A6',
  Applied: '#7FA6D9',
  Talking: '#A99BE0',
  Won: '#7CCB9A',
  Lost: '#D98585',
};

export const fonts = {
  serif: 'InstrumentSerif_400Regular',
  serifItalic: 'InstrumentSerif_400Regular_Italic',
  regular: 'Manrope_400Regular',
  medium: 'Manrope_500Medium',
  semibold: 'Manrope_600SemiBold',
  bold: 'Manrope_700Bold',
  heavy: 'Manrope_800ExtraBold',
};

export const brassGradient = [colors.brassHi, colors.brass, colors.brassLo] as const;

export const radius = 18;

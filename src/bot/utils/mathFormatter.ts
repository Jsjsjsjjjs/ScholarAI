/**
 * Utility to process, scrub, and beautify LaTeX/KaTeX scientific, chemical, and mathematical notations
 * into clear, highly readable Unicode symbols and perfectly styled signs for Discord client messages.
 */

export function formatMathAndScience(text: string): string {
  if (!text) return text;
  
  let result = text;
  
  // 1. First, fix raw LaTeX fractions: \frac{a}{b} -> (a) / (b)
  let fracRegex = /\\frac\s*\{([^}]+)\}\s*\{([^}]+)\}/g;
  while (fracRegex.test(result)) {
    result = result.replace(fracRegex, '($1)/($2)');
  }
  
  // Also support \frac A B if simple
  result = result.replace(/\\frac\s*(\d|\w)\s*(\d|\w)/g, '$1/$2');

  // 2. Remove \text{...}, \mathrm{...}, \mathbf{...}, \bold{...}, \underline{...}
  result = result.replace(/\\text\s*\{([^}]+)\}/g, '$1');
  result = result.replace(/\\mathrm\s*\{([^}]+)\}/g, '$1');
  result = result.replace(/\\mathbf\s*\{([^}]+)\}/g, '$1');
  result = result.replace(/\\bold\s*\{([^}]+)\}/g, '***$1***');
  result = result.replace(/\\underline\s*\{([^}]+)\}/g, '__$1__');

  // 3. Subscripts with braces: _{2} or _{H2O} -> replace digits/letters with unicode subscripts
  const subMap: Record<string, string> = {
    '0': '₀', '1': '₁', '2': '₂', '3': '₃', '4': '₄', '5': '₅', '6': '₆', '7': '₇', '8': '₈', '9': '₉',
    '+': '₊', '-': '₋', '=': '₌', '(': '₍', ')': '₎', 'a': 'ₐ', 'e': 'ₑ', 'o': 'ₒ', 'x': 'ₓ', 'n': 'ₙ',
    'i': 'ᵢ', 'j': 'ⱼ', 'h': 'ₕ', 'k': 'ₖ', 'l': 'ₗ', 'm': 'ₘ', 'p': 'ₚ', 's': 'ₛ', 't': 'ₜ'
  };

  const superMap: Record<string, string> = {
    '0': '⁰', '1': '¹', '2': '²', '3': '³', '4': '⁴', '5': '⁵', '6': '⁶', '7': '⁷', '8': '⁸', '9': '⁹',
    '+': '⁺', '-': '⁻', '=': '⁼', '(': '⁽', ')': '⁾', 'x': 'ˣ', 'n': 'ⁿ', 'i': 'ⁱ', 'a': 'ᵃ', 'b': 'ᵇ',
    'c': 'ᶜ', 'd': 'ᵈ', 'e': 'ᵉ', 'f': 'ᶠ', 'g': 'ᵍ', 'h': 'ʰ', 'j': 'ʲ', 'k': 'ᵏ', 'l': 'ˡ', 'm': 'ᵐ',
    'o': 'ᵒ', 'p': 'ᵖ', 'r': 'ʳ', 's': 'ˢ', 't': 'ᵗ', 'u': 'ᵘ', 'v': 'ᵛ', 'w': 'ʷ', 'y': 'ʸ'
  };

  // Replace _{...}
  result = result.replace(/_\{([^}]+)\}/g, (match, p1) => {
    return p1.split('').map((char: string) => subMap[char.toLowerCase()] || char).join('');
  });

  // Replace ^{...}
  result = result.replace(/\^\{([^}]+)\}/g, (match, p1) => {
    return p1.split('').map((char: string) => superMap[char.toLowerCase()] || char).join('');
  });

  // Replace single character subscripts and superscripts: _2 or ^2
  result = result.replace(/_([0-9a-exnijhk-mpst])/gi, (match, p1) => {
    return subMap[p1.toLowerCase()] || match;
  });

  result = result.replace(/\^([0-9+-=xnia-g-hj-m-o-rvwy])/gi, (match, p1) => {
    return superMap[p1.toLowerCase()] || match;
  });

  // 4. Map chemistry and physics operators & symbols
  const latexSymbols: [RegExp, string][] = [
    [/\\theta/gi, 'θ'],
    [/\\pi/gi, 'π'],
    [/\\alpha/gi, 'α'],
    [/\\beta/gi, 'β'],
    [/\\gamma/gi, 'γ'],
    [/\\delta/gi, 'δ'],
    [/\\Delta/gi, 'Δ'],
    [/\\sigma/gi, 'σ'],
    [/\\omega/gi, 'ω'],
    [/\\Omega/gi, 'Ω'], // Ohm symbol
    [/\\lambda/gi, 'λ'],
    [/\\phi/gi, 'φ'],
    [/\\psi/gi, 'ψ'],
    [/\\rho/gi, 'ρ'],
    [/\\tau/gi, 'τ'],
    [/\\eta/gi, 'η'],
    [/\\epsilon/gi, 'ε'],
    [/\\infty/gi, '∞'],
    [/\\pm/gi, '±'],
    [/\\approx/gi, '≈'],
    [/\\neq/gi, '≠'],
    [/\\leq/gi, '≤'],
    [/\\geq/gi, '≥'],
    [/\\le/gi, '≤'],
    [/\\ge/gi, '≥'],
    [/\\times/gi, '×'],
    [/\\cdot/gi, '·'],
    [/\\div/gi, '÷'],
    [/\\rightarrow/gi, '→'],
    [/\\to/gi, '→'],
    [/\\rightleftharpoons/gi, '⇌'],
    [/\\uparrow/gi, '↑'],
    [/\\downarrow/gi, '↓'],
    [/\\degree/gi, '°'],
    [/\\\^\s*\\circ\s*/g, '°'],
    [/\\\^\s*\{\s*\\circ\s*\}/g, '°'],
    [/\\sqrt\s*\{([^}]+)\}/gi, '√($1)'],
    [/\\sqrt/gi, '√'],
    [/\\sin\s*(?:\^2|²)?/gi, 'sin²'],
    [/\\cos\s*(?:\^2|²)?/gi, 'cos²'],
    [/\\tan\s*(?:\^2|²)?/gi, 'tan²'],
    [/\\csc\s*(?:\^2|²)?/gi, 'csc²'],
    [/\\sec\s*(?:\^2|²)?/gi, 'sec²'],
    [/\\cot\s*(?:\^2|²)?/gi, 'cot²'],
    [/\\log/gi, 'log'],
    [/\\ln/gi, 'ln']
  ];

  for (const [regex, replacement] of latexSymbols) {
    result = result.replace(regex, replacement);
  }

  // 5. Replace block and inline LaTeX anchors from Web markup:
  result = result.replace(/\\\[([\s\S]*?)\\\]/g, (match, p1) => {
    const cleaned = p1.trim();
    // Use code-brackets formatting for displays
    return `\n\`\`\`\n${cleaned}\n\`\`\`\n`;
  });

  result = result.replace(/\\\(([\s\S]*?)\\\)/g, (match, p1) => {
    return p1.trim();
  });

  result = result.replace(/\$\$([\s\S]*?)\$\$/g, (match, p1) => {
    const cleaned = p1.trim();
    return `\n\`\`\`\n${cleaned}\n\`\`\`\n`;
  });

  // Finally remove standard single dollar signs representing formula blocks
  result = result.replace(/\$([^$]+)\$/g, '$1');

  // Let's do some minor cleanup of any trailing/residual formatting characters
  result = result.replace(/\\$/g, '');
  result = result.replace(/\\quad/gi, '   ');
  result = result.replace(/\\qquad/gi, '      ');
  result = result.replace(/\\,/g, ' ');
  result = result.replace(/\\;/g, ' ');
  result = result.replace(/\\!/g, '');

  return result;
}

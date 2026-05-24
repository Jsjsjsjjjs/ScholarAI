const { mdToPdf } = require('md-to-pdf');
mdToPdf({ content: '# Hello PDF' }).then(p => {
    console.log("PDF LENGTH:", p.content.length);
}).catch(e => console.error("PDF ERROR:", e));

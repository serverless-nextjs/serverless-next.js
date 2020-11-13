module.exports = {
  render: (req, res) => {
    res.end("pages/customers/index.js");
  },
  renderReqToHTML: (req, res) => {
    return {
      renderOpts: {
        pageData: {
          page: "pages/customers/index.js"
        }
      }
    };
  }
};

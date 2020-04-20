module.exports = {
  render: (req, res) => {
    res.end("pages/customers/[...catchAll].js");
  }
};

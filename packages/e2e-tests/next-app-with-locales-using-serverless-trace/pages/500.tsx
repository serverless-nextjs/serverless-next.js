export default function Custom500() {
  return <h1>Custom 500</h1>;
}

export async function getStaticProps() {
  return {
    props: {}
  };
}

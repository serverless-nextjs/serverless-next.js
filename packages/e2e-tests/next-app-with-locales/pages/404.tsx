import { useRouter } from "next/router";
import React from "react";

export default function Custom404() {
  const { locale } = useRouter();

  return (
    <>
      <h1>Custom 404</h1>
      <p data-cy="locale">{locale}</p>
    </>
  );
}

export async function getStaticProps() {
  return {
    props: {}
  };
}

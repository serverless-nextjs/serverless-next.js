import React from "react";
import { GetStaticProps } from "next";

type DynamicIndexPageProps = {
  slug: string;
};

export default function DynamicIndexPage(
  props: DynamicIndexPageProps
): JSX.Element {
  return (
    <React.Fragment>
      <div>
        {`Hello ${props.slug}. This is a dynamic SSG page using getStaticProps() with fallback blocking.`}
      </div>
    </React.Fragment>
  );
}

export const getStaticProps: GetStaticProps = async (ctx) => {
  return {
    props: {
      slug: ctx.params?.slug as string
    }
  };
};

export async function getStaticPaths() {
  return {
    paths: [{ params: { slug: "a" } }, { params: { slug: "b" } }],
    fallback: "blocking"
  };
}

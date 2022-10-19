import React from "react";
import { GetStaticPaths, GetStaticProps } from "next";
import { useRouter } from "next/router";

type DynamicIndexPageProps = {
  slug: string;
};

export default function DynamicIndexPage(
  props: DynamicIndexPageProps
): JSX.Element {
  const router = useRouter();
  return (
    <React.Fragment>
      <div>
        {`Hello ${props.slug}. This is a dynamic SSG page using getStaticProps() with fallback blocking.`}
      </div>
      <div>{`|${router.asPath}|`}</div>
    </React.Fragment>
  );
}

const PRE_EXISTING_SLUGS = ["a", "b"];
const SLUGS = [...PRE_EXISTING_SLUGS, "c"];

export const getStaticProps: GetStaticProps = (ctx) => {
  const slug = ctx.params?.slug;
  if (typeof slug === "string" && SLUGS.includes(slug)) {
    return {
      props: {
        slug: slug as string
      }
    };
  } else {
    return { notFound: true };
  }
};

export const getStaticPaths: GetStaticPaths = () => ({
  paths: PRE_EXISTING_SLUGS.map((slug) => ({ params: { slug } })),
  fallback: "blocking"
});

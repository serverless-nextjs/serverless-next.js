import React from "react";
import { GetServerSidePropsContext, GetStaticPropsResult } from "next";

type OptionalCatchAllPageProps = {
  name: string;
  catch: string;
};

export default function OptionalCatchAllPage(
  props: OptionalCatchAllPageProps
): JSX.Element {
  return (
    <React.Fragment>
      <div>
        {`Hello ${props.name}. This is optional-catch-all-ssg-with-fallback, an optional catch-all SSG page using getStaticProps() and fallback: true. It also has an image.`}
      </div>
      <p data-cy="catch">{props.catch}</p>
      <img src={"/app-store-badge.png"} alt={"An image"} />
    </React.Fragment>
  );
}

export async function getStaticProps(
  ctx: GetServerSidePropsContext
): Promise<GetStaticPropsResult<OptionalCatchAllPageProps>> {
  const catchAll = ((ctx.params?.catch as string[]) ?? []).join("/");

  if (catchAll === "not-found") {
    return {
      notFound: true
    };
  }

  return {
    props: { name: "serverless-next.js", catch: catchAll }
  };
}

export async function getStaticPaths() {
  return {
    paths: [
      { params: { catch: [] } },
      { params: { catch: ["a"] } },
      { params: { catch: ["b"] } }
    ],
    fallback: true
  };
}

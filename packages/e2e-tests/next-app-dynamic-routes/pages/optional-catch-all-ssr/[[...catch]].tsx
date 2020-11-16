import React from "react";
import { GetServerSidePropsContext } from "next";

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
        {`Hello ${props.name}. This is optional-catch-all-ssr, an optional catch-all SSR page using getServerSideProps(). It also has an image.`}
      </div>
      <p data-cy="catch">{props.catch}</p>
      <img src={"/app-store-badge.png"} alt={"An image"} />
    </React.Fragment>
  );
}

export async function getServerSideProps(
  ctx: GetServerSidePropsContext
): Promise<{ props: OptionalCatchAllPageProps }> {
  const catchAll = ((ctx.params?.catch as string[]) ?? []).join("/");

  return {
    props: { name: "serverless-next.js", catch: catchAll }
  };
}

import React from "react";
import { NextPageContext } from "next";

type DynamicNestedPageProps = {
  name: string;
};

export default function DynamicNestedPage(
  props: DynamicNestedPageProps
): JSX.Element {
  return (
    <React.Fragment>
      <div>
        {`Hello ${props.name}. This is a dynamic SSG page using getStaticProps() with fallback false. It also has an image.`}
      </div>
      <img src={"/app-store-badge.png"} alt={"An image"} />
    </React.Fragment>
  );
}

export async function getStaticProps(
  ctx: NextPageContext
): Promise<{ props: DynamicNestedPageProps }> {
  return {
    props: { name: "serverless-next.js" }
  };
}

export async function getStaticPaths() {
  return {
    paths: [{ params: { dynamic: "a" } }, { params: { dynamic: "b" } }],
    fallback: false
  };
}

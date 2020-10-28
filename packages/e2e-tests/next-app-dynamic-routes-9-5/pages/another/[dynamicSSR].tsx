import React from "react";
import { NextPageContext } from "next";

type DynamicSSRPageProps = {
  name: string;
};

export default function DynamicSSRPage(
  props: DynamicSSRPageProps
): JSX.Element {
  return (
    <React.Fragment>
      <div>{`Hello ${props.name}. This is dynamic-ssr, a dynamic SSR page.`}</div>
    </React.Fragment>
  );
}

export async function getServerSideProps(
  ctx: NextPageContext
): Promise<{ props: DynamicSSRPageProps }> {
  return {
    props: { name: "serverless-next.js" }
  };
}

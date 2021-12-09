import React from "react";
import { NextPageContext } from "next";

type SSGPrioritizedOverDynamicSSRPageProps = {
  name: string;
};

export default function SSGPrioritizedOverDynamicSSRPage(
  props: SSGPrioritizedOverDynamicSSRPageProps
): JSX.Element {
  return (
    <React.Fragment>
      {`Hello ${props.name}! This is ssg-prioritized-over-dynamic-ssr, to test that predefined SSG page is prioritized over dynamic SSR page.`}
    </React.Fragment>
  );
}

export async function getStaticProps(
  ctx: NextPageContext
): Promise<{ props: SSGPrioritizedOverDynamicSSRPageProps }> {
  return {
    props: { name: "serverless-next.js" }
  };
}

import React from "react";
import { NextPageContext } from "next";

type NestedSSRPageProps = {
  name: string;
};

export default function NestedSSRPage(props: NestedSSRPageProps): JSX.Element {
  return (
    <React.Fragment>
      {`Hello ${props.name}! This is an NestedSSR Page using getInitialProps().`}
    </React.Fragment>
  );
}

// getInitialProps() is the old way of doing SSR
NestedSSRPage.getInitialProps = async (
  ctx: NextPageContext
): Promise<NestedSSRPageProps> => {
  return { name: "serverless-next.js" };
};

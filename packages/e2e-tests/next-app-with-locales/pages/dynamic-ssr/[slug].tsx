import React from "react";
import { NextPageContext } from "next";
import { useRouter } from "next/router";

type SSRPageProps = {
  name: string;
};

export default function SSRPage(props: SSRPageProps): JSX.Element {
  const { query } = useRouter();
  return (
    <React.Fragment>
      {`Hello ${props.name} at ${query.slug}! This is an SSR Page using getInitialProps().`}
    </React.Fragment>
  );
}

// getInitialProps() is the old way of doing SSR
SSRPage.getInitialProps = async (
  ctx: NextPageContext
): Promise<SSRPageProps> => {
  return { name: "serverless-next.js" };
};

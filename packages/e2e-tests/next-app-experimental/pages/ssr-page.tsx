import React from "react";

type SSRPageProps = {
  name: string;
};

export default function SSRPage(props: SSRPageProps): JSX.Element {
  return (
    <React.Fragment>
      {`Hello ${props.name}! This is an SSR Page using getInitialProps().`}
    </React.Fragment>
  );
}

// getInitialProps() is the old way of doing SSR
SSRPage.getInitialProps = (): SSRPageProps => {
  return { name: "serverless-next.js" };
};

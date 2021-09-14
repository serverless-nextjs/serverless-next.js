import React from "react";

type ErroredPageProps = {
  name: string;
};

export default function ErroredPageProps(props: ErroredPageProps): JSX.Element {
  return (
    <React.Fragment>
      {`Hello ${props.name}! This is an SSR Page using getInitialProps(). But you should not see the rendered content as it throws an error.`}
    </React.Fragment>
  );
}

// getInitialProps() is the old way of doing SSR
ErroredPageProps.getInitialProps = (): ErroredPageProps => {
  // Simulate a server-side error by always throwing an error.
  throw new Error(`Error occurred!`);
};

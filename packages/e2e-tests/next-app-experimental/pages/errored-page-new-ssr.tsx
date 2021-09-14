import React from "react";

type ErroredPageNewSsrProps = {
  name: string;
};

export default function ErroredPageNewSsr(
  props: ErroredPageNewSsrProps
): JSX.Element {
  return (
    <React.Fragment>
      {`Hello ${props.name}! This is an SSR Page using getServerSideProps(). But you should not see the rendered content as it throws an error.`}
    </React.Fragment>
  );
}

export function getServerSideProps(): {
  props: ErroredPageNewSsrProps;
} {
  throw new Error("Error occurred!");
}

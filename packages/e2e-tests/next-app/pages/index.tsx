import React from "react";
import { GetStaticPropsContext } from "next";

type IndexPageProps = {
  name: string;
  preview: boolean;
};

export default function IndexPage(props: IndexPageProps): JSX.Element {
  return (
    <React.Fragment>
      {`Hello ${props.name}! This is an SSG Page using getStaticProps().`}
      <div>
        <p data-cy="preview-mode">{String(props.preview)}</p>
      </div>
    </React.Fragment>
  );
}

export function getStaticProps(ctx: GetStaticPropsContext): {
  props: IndexPageProps;
} {
  return {
    props: {
      name: "serverless-next.js",
      preview: !!ctx.preview
    }
  };
}

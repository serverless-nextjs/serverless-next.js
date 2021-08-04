import React from "react";
import { GetStaticPropsContext } from "next";
import { useRouter } from "next/router";

type SSGPageProps = {
  name: string;
  preview: boolean;
};

export default function SSGPage(props: any): JSX.Element {
  const {
    query: { segments = [] },
    locale
  } = useRouter();
  return (
    <React.Fragment>
      {`Hello ${props.name}! This is an SSG Page using getStaticProps().`}
      <div>
        <p data-cy="preview-mode">{String(props.preview)}</p>
      </div>
      <p data-cy="locale">{locale}</p>
      <p data-cy="segments">{segments}</p>
    </React.Fragment>
  );
}

export function getStaticProps(ctx: GetStaticPropsContext): {
  props: SSGPageProps;
} {
  return {
    props: {
      name: "serverless-next.js",
      preview: !!ctx.preview
    }
  };
}

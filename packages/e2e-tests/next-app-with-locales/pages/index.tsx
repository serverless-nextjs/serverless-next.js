import React from "react";
import { useRouter } from "next/router";

type IndexPageProps = {
  name: string;
};

export default function IndexPage(props: IndexPageProps): JSX.Element {
  const {
    query: { segments = [] },
    locale
  } = useRouter();
  return (
    <React.Fragment>
      <div>
        <p>
          {`Hello ${props.name}. This is an SSG page using getStaticProps(). It also has an image.`}
        </p>
        <p data-cy="locale">{locale}</p>
        <p data-cy="segments">{segments}</p>
      </div>
      <img src={"/app-store-badge.png"} alt={"An image"} />
    </React.Fragment>
  );
}

export function getStaticProps(): { props: IndexPageProps } {
  return {
    props: { name: "serverless-next.js" }
  };
}

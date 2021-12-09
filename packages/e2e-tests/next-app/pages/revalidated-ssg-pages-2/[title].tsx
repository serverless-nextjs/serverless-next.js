import React from "react";
import { GetStaticPaths, GetStaticPropsResult } from "next";

type SSGPageProps = {
  date: string;
};

export default function RevalidatedSSGPage(props: SSGPageProps): JSX.Element {
  return (
    <React.Fragment>
      <div>
        <p data-cy="date-text">{props.date}</p>
      </div>
    </React.Fragment>
  );
}

export function getStaticPaths() {
  const paths = [{ params: { title: "with space" } }];
  return { paths, fallback: true };
}

export function getStaticProps(): GetStaticPropsResult<SSGPageProps> {
  return {
    revalidate: 10,
    props: {
      date: new Date().toJSON()
    }
  };
}

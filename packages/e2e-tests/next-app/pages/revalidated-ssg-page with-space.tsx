import React from "react";
import { GetStaticPropsResult } from "next";

type SSGPageProps = {
  date: string;
};

export default function RevalidatedSSGPageWithSpace(
  props: SSGPageProps
): JSX.Element {
  return (
    <React.Fragment>
      <div>
        <p data-cy="date-text">{props.date}</p>
      </div>
    </React.Fragment>
  );
}

export function getStaticProps(): GetStaticPropsResult<SSGPageProps> {
  return {
    revalidate: 10,
    props: {
      date: new Date().toJSON()
    }
  };
}

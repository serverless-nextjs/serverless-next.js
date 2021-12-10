import React from "react";
import {
  GetStaticPaths,
  GetStaticPropsContext,
  GetStaticPropsResult
} from "next";

const sampleUserData = [
  { id: 101, name: "Alice" },
  { id: 102, name: "Bob" },
  { id: 103, name: "Caroline" },
  { id: 104, name: "Dave" }
];

const newUser = { id: 105, name: "Henry" };

type SSGPageProps = {
  date: string;
  user?: typeof sampleUserData[number];
};

export default function RevalidatedSSGPage(props: SSGPageProps): JSX.Element {
  return (
    <React.Fragment>
      <div>
        <p data-cy="date-text">{props.date}</p>
        <p data-cy="user-id-text">{props.user?.id ?? "No user found"}</p>
      </div>
    </React.Fragment>
  );
}

export const getStaticPaths: GetStaticPaths = () => {
  // To simulate new data becoming available in a data source we only make the
  // `newUser` available when rendering on AWS, rather than at build time.
  const runningOnAws = !!process.env.AWS_LAMBDA_FUNCTION_NAME;
  const paths = sampleUserData.map((user) => ({
    params: { id: user.id.toString() }
  }));

  if (runningOnAws) {
    paths.push({ params: { id: newUser.id.toString() } });
  }

  return { paths, fallback: "blocking" };
};

export function getStaticProps(
  context: GetStaticPropsContext<{ id: string }>
): GetStaticPropsResult<SSGPageProps> {
  const users = [...sampleUserData, newUser];
  const user = users.find(
    ({ id }) => context.params?.id.toString() === id.toString()
  );
  return {
    revalidate: 10,
    props: {
      date: new Date().toJSON(),
      user
    }
  };
}

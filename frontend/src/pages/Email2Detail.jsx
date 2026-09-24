import { EmailViewer2 } from "../components/EmailViewer2";
import { useParams } from "wouter";
import { Layout2 } from "../components/Layout2";

export function Email2Detail({ id }) {
	const params = useParams();

	return (
		<Layout2>
			<EmailViewer2 id={params.id} />
		</Layout2>
	);
}

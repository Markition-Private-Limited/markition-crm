import { Card, CardBody, CardHeader, Skeleton } from "@/components/ui";

export default function TaskDetailLoading() {
  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <Skeleton className="h-4 w-20" />
        <Skeleton className="h-8 w-80" />
      </div>

      <div className="grid gap-4 xl:grid-cols-[1.5fr_1fr]">
        <Card>
          <CardHeader>
            <Skeleton className="h-6 w-40" />
          </CardHeader>
          <CardBody className="space-y-3">
            {Array.from({ length: 9 }).map((_, index) => (
              <Skeleton key={index} className="h-12 w-full" />
            ))}
          </CardBody>
        </Card>

        <div className="space-y-4">
          <Card>
            <CardHeader>
              <Skeleton className="h-6 w-32" />
            </CardHeader>
            <CardBody className="space-y-3">
              {Array.from({ length: 6 }).map((_, index) => (
                <Skeleton key={index} className="h-10 w-full" />
              ))}
            </CardBody>
          </Card>
          <Card>
            <CardHeader>
              <Skeleton className="h-6 w-36" />
            </CardHeader>
            <CardBody>
              <Skeleton className="h-20 w-full" />
            </CardBody>
          </Card>
        </div>
      </div>
    </div>
  );
}

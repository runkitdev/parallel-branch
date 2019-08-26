const { Δ,  is, data, any, number, string, union, boolean, object } = require("@algebraic/type");
const { List, Map, OrderedSet, Set } = require("@algebraic/collections");
const Task = require("./task");
const Independent = require("./independent");
const KeyPath = require("@algebraic/ast/key-path");
const until = require("@climb/until");
const update = require("@cause/cause/update");


const Thenable = object;

const ContentAddress    = string;
const zeroed = T => [T, T()];


const Isolate = data `Isolate` (
    entrypoint          =>  any,

    memoizations        =>  zeroed(Map(ContentAddress, any)),
    running             =>  zeroed(Set(ContentAddress)),
    
    succeeded           =>  Function,
    failed              =>  Function,

    RIDs            =>  [Map(string, number), Map(string, number)()],
    nextRID         =>  [number, 0],

    active          =>  [Set(string), Set(string)()],

    free            =>  [OrderedSet(number), OrderedSet(number)()],
    occupied        =>  [Map(number, Thenable), Map(number, Thenable)()],
    ([hasVacancy])  =>  [boolean, free => free.size > 0]
    /*,
    open        =>  List(Task),
    running     =>  Map(string, Task),
    memoized    =>  Map(string, Task),
    finish      =>  Function,
    settle      =>  Function*/ );


module.exports = function run(entrypoint, concurrency = 1)
{
    return new Promise(function (resolve, reject)
    {
        const range = Array.from({ length: concurrency }, (_, index) => index);
        const free = OrderedSet(number)(range);

        const settled = cast => UUID =>
            value => console.log("AND NOW " +(isolate = Isolate.settle(isolate, cast(value), UUID)));
        const succeeded = settled(value => Task.Success({ value }));
        const failed = settled(error => Task.Failure.from(error));

        let isolate = Isolate({ entrypoint, free, succeeded, failed });

        const [uIsolate, uEntrypoint] =
            Task.Continuation.start(isolate, entrypoint, "ROOT");

        isolate = Δ(uIsolate, { entrypoint: uEntrypoint });

        console.log(isolate);
    });
}

// invocation *intrinsically* unmemoizable
// requested umemoizable
// memoizable

// Probably fail if already exists?
Isolate.assignExecutionID = function (isolate, invocation, memoizable)
{
    const { nextRID } = isolate;
    const contentAddress = !!memoizable && getContentAddressOf(invocation);

    if (contentAddress === false)
        return [Δ(isolate, { nextRID: nextRID + 1 }), nextRID];

    if (isolate.RIDs.has(contentAddress))
        return [isolate, isolate.RIDs.get(contentAddress)];

    const uRIDs = Δ(RIDs, { RIDs: isolate.RIDs.set(contentAddress, nextRID) });
    const uNextRID = nextRID + 1;
    const uIsolate = Δ(isolate, { nextRID: uNextRID, RIDs: uRIDs });

    return [uIsolate, nextRID];
}


Isolate.settle = function (isolate, result, forUUID)
{console.log("here....");
    const uMemoizations = isolate.memoizations.set(forUUID, result);
    const [uIsolate, entrypoint] = Task.Continuation.settle(
        Δ(isolate, { memoizations: uMemoizations }),
        isolate.entrypoint,
        Set(string)([forUUID]));

    return Δ(uIsolate, { entrypoint });
}

Isolate.allot = function (isolate, thenable, forUUID)
{
    const slot = isolate.free.first();
    const uFree = isolate.free.remove(slot);
    const uOccupied = isolate.occupied.set(slot, thenable);
    const uIsolate = Δ(isolate, { free: uFree, occupied: uOccupied });

    // We Promise wrap because we can't be sure that then() won't do something
    // synchronously.
    Promise
        .resolve(thenable)
        .then(isolate.succeeded(forUUID), isolate.failed(forUUID));

    return uIsolate;
}


/*
    
    if (ready.length <= 0)
        return [graph, isolate];

    const [uGraph, uIsolate, dependents] = ready
        .reduce(run, [graph, isolate, DenseIntSet.Empty]);
    const uCompleted = uGraph.completed;
    const uReady = DenseIntSet
        .toArray(dependents)
        .filter(index => DenseIntSet
            .isSubsetOf(uCompleted, nodes.get(index).dependencies));

    return reduce(uGraph, uReady, uIsolate);*/
//}
